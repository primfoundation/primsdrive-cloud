import assert from 'node:assert/strict';
import { it } from 'node:test';
import worker from '../src/index.ts';
import type { AgentEnv } from '../src/agent.ts';
const token = 'agt_' + 'a'.repeat(43);
function setup() {
  const state = { active: true, allowed: true, calls: [] as string[], miniCalls: 0 };
  const env: AgentEnv = {
    MINI_PROBE_SECRET: 'b'.repeat(64),
    DRIVE_ACCOUNT_PROFILES: JSON.stringify({ owner: ['canary'] }),
    PRIMS_SSO: { fetch: async (r: Request) => {
      state.calls.push(r.url);
      assert.equal(r.headers.get('cookie'), null);
      assert.equal(r.redirect, 'manual');
      const b = await r.json() as Record<string, unknown>;
      if (r.url.endsWith('/introspect')) {
        assert.equal(b.token, token);
        return Response.json(state.active ? {active: true, account_id: 'owner', agent_id: 'agent'} : {active:false}, {status:state.active ? 200 : 401});
      }
      assert.equal(b.resource, 'primsdrive:profile:canary');
      return Response.json({allow: state.allowed});
    } },
    MINI_HELLO: { fetch: async r => {
      state.miniCalls++;
      assert.equal(r.headers.get('authorization'), 'Bearer ' + 'b'.repeat(64));
      assert.equal(r.headers.get('cookie'), null);
      assert.equal(r.url, 'http://127.0.0.1:18746/rpc');
      return Response.json({entries: [], king_ack: true});
    } },
  };
  return { state, env };
}
function request(path: string, method='GET', body?: unknown, headers: Record<string,string> = {}) {
  return new Request('https://drive.prims.sh'+path, {method, headers: {authorization:'Bearer '+token, 'content-type':'application/json', ...headers}, body:body === undefined ? undefined : JSON.stringify(body)});
}
it('rejects cookies, wrong token types, unassigned accounts and foreign profiles', async () => {
  const {env,state}=setup();
  for (const authorization of ['', 'Bearer stytch-session', 'Bearer invalid']) {
    const r = request('/v1/packs?profile=canary','GET',undefined,{authorization,cookie:'prims_session=human'});
    assert.equal((await worker.fetch(r,env)).status,401);
  }
  assert.equal((await worker.fetch(request('/v1/packs?profile=foreign'),env)).status,403);
  assert.equal((await worker.fetch(request('/v1/packs?profile=canary'),{...env,DRIVE_ACCOUNT_PROFILES:'{}'})).status,403);
  assert.equal(state.miniCalls,0);
});
it('checks live revocation and policy on every call, forwarding no client credential', async () => {
  const {env,state}=setup();
  assert.equal((await worker.fetch(request('/v1/packs?profile=canary'),env)).status,200);
  state.active=false;
  assert.equal((await worker.fetch(request('/v1/packs?profile=canary'),env)).status,401);
  state.active=true;state.allowed=false;
  assert.equal((await worker.fetch(request('/v1/packs?profile=canary'),env)).status,403);
  assert.equal(state.miniCalls,1);
  assert.equal(state.calls.filter(x=>x.endsWith('introspect')).length,3);
});
it('requires conditional writes and rejects traversal and invalid encodings', async () => {
  const {env,state}=setup();
  assert.equal((await worker.fetch(request('/v1/packs?profile=canary&path=a','PUT',{content_base64:'aGk='}),env)).status,428);
  for (const path of ['../x','/etc/passwd','a//x','a/.x','a\\x']) {
    assert.equal((await worker.fetch(request('/v1/packs?profile=canary&path='+encodeURIComponent(path)),env)).status,400);
  }
  assert.equal((await worker.fetch(request('/v1/packs?profile=canary&path=a','PUT',{content_base64:'!'}, {'if-none-match':'*'}),env)).status,400);
  assert.equal(state.miniCalls,0);
  assert.equal((await worker.fetch(request('/v1/packs?profile=canary&path=a','PUT',{content_base64:'aGk='}, {'if-none-match':'*'}),env)).status,200);
});
it('MCP negotiates, lists tools, calls through the same authorization, and rejects origins', async () => {
  const {env,state}=setup();
  const send=(body:unknown, headers:Record<string,string>={})=>worker.fetch(request('/mcp','POST',body,{accept:'application/json, text/event-stream',...headers}),env);
  const init=await (await send({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',clientInfo:{name:'test',version:'1'},capabilities:{}}})).json() as any;
  assert.equal(init.result.protocolVersion,'2025-11-25');
  assert.equal((await send({jsonrpc:'2.0',method:'notifications/initialized'})).status,202);
  const list=await (await send({jsonrpc:'2.0',id:2,method:'tools/list'})).json() as any;
  assert.equal(list.result.tools.length,5);
  const call=await (await send({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'pack_list',arguments:{profile:'canary'}}})).json() as any;
  assert.equal(call.result.isError,false);
  assert.equal(state.miniCalls,1);
  assert.equal((await send({jsonrpc:'2.0',id:4,method:'tools/list'},{origin:'https://evil.invalid'})).status,403);
  state.active=false;
  assert.equal((await send({jsonrpc:'2.0',id:5,method:'tools/list'})).status,401);
});
it('identity failure is closed and HTML does not become authorized by agent credentials', async () => {
  const {env}=setup();
  assert.equal((await worker.fetch(request('/v1/packs?profile=canary'),{...env,PRIMS_SSO:undefined})).status,503);
  const root=await worker.fetch(request('/'),env);
  const b=await root.json() as any;
  assert.equal(b.status,'stub');
});
it('ChatGPT OAuth discovery stays gated until provider ready; audience and scopes are enforced',async()=>{
  const {env}=setup();
  const metadata=new Request('https://drive.prims.sh/.well-known/oauth-protected-resource');
  assert.equal((await worker.fetch(metadata,env)).status,503);
  assert.equal((await worker.fetch(metadata,{...env,MCP_OAUTH_ENABLED:'true'})).status,503);
  const enabled={...env,MCP_OAUTH_ENABLED:'true',MCP_OAUTH_ISSUER:'https://verified-issuer.example'};
  const discovery=await (await worker.fetch(metadata,enabled)).json() as any;
  assert.equal(discovery.resource,'https://drive.prims.sh');
  assert.deepEqual(discovery.authorization_servers,['https://verified-issuer.example']);
  assert.equal((await worker.fetch(metadata,{...enabled,MCP_OAUTH_ISSUER:'https://issuer.example/#bad'})).status,503);
  const r=await worker.fetch(request('/mcp','POST',{jsonrpc:'2.0',id:1,method:'tools/list'},{accept:'application/json, text/event-stream'}),enabled);
  assert.equal(r.status,401); // Legacy token lacks a Drive resource audience.
  assert.ok(r.headers.get('www-authenticate')?.includes('oauth-protected-resource'));
});

it('MCP insufficient OAuth scope returns the ChatGPT reauthorization signal without touching the king',async()=>{
  const {env,state}=setup();
  const enabled={...env,MCP_OAUTH_ENABLED:'true',PRIMS_SSO:{fetch:async()=>Response.json({active:true,account_id:'owner',agent_id:'agent',resource:'https://drive.prims.sh',scope:'primsdrive.read'})}};
  const r=await worker.fetch(request('/mcp','POST',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'pack_write',arguments:{profile:'canary',path:'a',content_base64:'aGk=',create:true}}},{accept:'application/json, text/event-stream'}),enabled);
  const b=await r.json() as any;
  assert.equal(b.result.isError,true);
  assert.match(b.result._meta['mcp/www_authenticate'][0],/insufficient_scope.*primsdrive.write/);
  assert.equal(state.miniCalls,0);
});

it('provider OAuth tokens use the issuer adapter; legacy REST stays on its own token contract',async()=>{
  const {env,state}=setup();const providerToken='eyJhbGciOiJSUzI1NiJ9.claims.signature';
  const enabled={...env,MCP_OAUTH_ENABLED:'true',PRIMS_SSO:{fetch:async(r:Request)=>{
    assert.equal(new URL(r.url).pathname,'/v1/oauth/introspect');
    assert.equal((await r.json() as any).token,providerToken);
    return Response.json({active:true,account_id:'owner',agent_id:'agent',resource:'https://drive.prims.sh',scope:'primsdrive.read'});
  }}};
  const result=await worker.fetch(request('/mcp','POST',{jsonrpc:'2.0',id:1,method:'tools/list'},
    {authorization:'Bearer '+providerToken,accept:'application/json, text/event-stream'}),enabled);
  assert.equal(result.status,200);assert.equal((await result.json() as any).result.tools.length,5);
  assert.equal((await worker.fetch(request('/v1/packs?profile=canary','GET',undefined,{authorization:'Bearer '+providerToken}),enabled)).status,401);
  assert.equal(state.miniCalls,0);
});

import assert from 'node:assert/strict';
import { it } from 'node:test';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import worker from '../src/index.ts';
import type { AgentEnv } from '../src/agent.ts';
it('API and MCP round-trip through real Python HTTP and isolated filesystem; revocation prevents reads',async()=>{
  const root=await mkdtemp(join(tmpdir(),'primsdrive-test-'));
  const secret='c'.repeat(64);let active=true;
  const python=spawn('python3',['-u','-c',
    "import sys;sys.path.insert(0,'mini');from server import handler;from store import Store;from http.server import ThreadingHTTPServer;s=ThreadingHTTPServer(('127.0.0.1',0),handler(Store(sys.argv[1]),sys.argv[2]));print(s.server_port,flush=True);s.serve_forever()",root,secret],{stdio:['ignore','pipe','pipe']});
  let stderr='';python.stderr.on('data',d=>stderr+=d);
  try {
    const port=await new Promise<number>((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Python startup timeout '+stderr)),5000);
      python.stdout.once('data',d=>{clearTimeout(timer);resolve(Number(String(d).trim()));});
      python.once('error',e=>{clearTimeout(timer);reject(e);});
      python.once('exit',()=>{clearTimeout(timer);reject(new Error(stderr));});
    });
    const env:AgentEnv={MINI_PROBE_SECRET:secret,DRIVE_ACCOUNT_PROFILES:JSON.stringify({owner:['canary']}),
      PRIMS_SSO:{fetch:async r=>Response.json(r.url.endsWith('introspect')?(active?{active:true,agent_id:'agent',account_id:'owner'}:{active:false}):{allow:true},{status:r.url.endsWith('introspect')&&!active?401:200})},
      MINI_HELLO:{fetch:async r=>fetch(new Request(`http://127.0.0.1:${port}${new URL(r.url).pathname}`,r))}};
    const bearer='Bearer agt_'+'a'.repeat(43);
    const req=(path:string,method='GET',body?:unknown,headers:Record<string,string>={})=>new Request('https://drive.prims.sh'+path,{method,headers:{authorization:bearer,'content-type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});
    const target='/v1/packs?profile=canary&path=proof.prim';
    const created=await worker.fetch(req(target,'PUT',{content_base64:Buffer.from('canary').toString('base64')},{'if-none-match':'*'}),env);
    assert.equal(created.status,200,await created.clone().text());
    const put=await created.json() as any;assert.equal(put.king_ack,true);
    const read=await (await worker.fetch(req(target),env)).json() as any;
    assert.equal(Buffer.from(read.content_base64,'base64').toString(),'canary');
    const tool=await worker.fetch(req('/mcp','POST',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'pack_write',arguments:{profile:'canary',path:'proof.prim',content_base64:Buffer.from('mcp').toString('base64'),match:read.etag}}},{accept:'application/json, text/event-stream'}),env);
    const result=await tool.json() as any;assert.equal(result.result.isError,false);
    const updated=await (await worker.fetch(req(target),env)).json() as any;
    assert.equal(Buffer.from(updated.content_base64,'base64').toString(),'mcp');
    active=false;assert.equal((await worker.fetch(req(target),env)).status,401);active=true;
    assert.equal((await worker.fetch(req(target,'DELETE',undefined,{'if-match':updated.etag}),env)).status,200);
    assert.equal((await worker.fetch(req(target),env)).status,404);
  } finally { const exited=once(python,'exit');python.kill();await exited;await rm(root,{recursive:true,force:true}); }
});

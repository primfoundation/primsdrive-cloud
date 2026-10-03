import assert from 'node:assert/strict';
import { it } from 'node:test';
import { verifyHuman, page, type HumanEnv } from '../src/human.ts';
import worker from '../src/index.ts';
const encode=(x:unknown)=>Buffer.from(JSON.stringify(x)).toString('base64url');
it('verifies human JWT signature, issuer, audience, expiry and explicit subject grants',async()=>{
  const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
  const jwk={...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'test'};
  const issuer='https://test.cloudflareaccess.com';
  const env:HumanEnv={ACCESS_ISSUER:issuer,ACCESS_AUD:'drive',DRIVE_HUMAN_PROFILES:JSON.stringify({human:['canary']})};
  const now=Math.floor(Date.now()/1000);
  const claims={iss:issuer,aud:['drive'],sub:'human',email:'test@example.com',nbf:now-1,exp:now+300};
  const sign=async(c:unknown)=>{const data=encode({alg:'RS256',kid:'test'})+'.'+encode(c);return data+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(data))).toString('base64url');};
  const keys=(async(url:unknown)=>{assert.equal(url,issuer+'/cdn-cgi/access/certs');return Response.json({keys:[jwk]});}) as typeof fetch;
  const req=(t:string)=>new Request('https://drive.prims.sh/app',{headers:{'cf-access-jwt-assertion':t}});
  const valid=await sign(claims);
  assert.deepEqual(await verifyHuman(req(valid),env,keys),{sub:'human',profiles:['canary']});
  for(const c of [{...claims,iss:'https://evil.invalid'},{...claims,aud:['other']},{...claims,exp:now-1},{...claims,nbf:now+300},{...claims,sub:'other'}]){
    await assert.rejects(()=>verifyHuman(req(valid.split('.')[0]+'.'+encode(c)+'.'+valid.split('.')[2]),env,keys));
    const awaitableToken=await sign(c);
    await assert.rejects(()=>verifyHuman(req(awaitableToken),env,keys));
  }
});
it('bearer alone never authorizes HTML; HTML session never authorizes agent API',async()=>{
  const req=new Request('https://drive.prims.sh/app',{headers:{authorization:'Bearer agt_'+'a'.repeat(43)}});
  assert.equal((await worker.fetch(req,{})).status,503);
  await assert.rejects(()=>verifyHuman(req,{ACCESS_ISSUER:'https://test.cloudflareaccess.com',ACCESS_AUD:'drive'}));
  const api=new Request('https://drive.prims.sh/v1/packs?profile=canary',{headers:{cookie:'CF_Authorization=fake','cf-access-jwt-assertion':'fake'}});
  assert.equal((await worker.fetch(api,{})).status,401);
});
it('renders escaped folder names and no credentials or active file content',async()=>{
  const response=page(['canary'],'canary','',{entries:[{name:'<script>alert(1)</script>',kind:'file',size:2}],next_offset:null},{readable:true,free_bytes:1024});
  const html=await response.text();assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.ok(response.headers.get('content-security-policy')?.includes("default-src 'none'"));
});

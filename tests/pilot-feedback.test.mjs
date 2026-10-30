import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { randomUUID } from "node:crypto";
import { validatePilotFeedback } from "../src/lib/pilot-feedback.ts";
import { isSameOriginRequest } from "../src/lib/security/request-origin.ts";

const example = () => ({ role: "school", areas: ["templates", "signature"], result: "completed", ease: 4, kind: "suggestion", summary: "Fictitious QA feedback", details: "Synthetic test only, with no child information.", steps: "", expected: "", allow_contact: false, privacy_confirmed: true });
test("feedback validates required choices, bounded text and privacy confirmation without adding identity fields", () => {
  assert.deepEqual(validatePilotFeedback(example()), example());
  assert.deepEqual(validatePilotFeedback({ ...example(), areas: ["pdf","pdf"] }).areas, ["pdf"]);
  assert.equal(validatePilotFeedback({ ...example(), summary: "  A useful title  " }).summary, "A useful title");
  for (const patch of [{ role:"admin" }, { areas:[] }, { areas:["private-child-id"] }, { privacy_confirmed:false }, { allow_contact:"yes" }, { ease:"4" }, { ease:6 }, { details:"" }, { summary:"x".repeat(161) }, { steps:"x".repeat(2001) }, { expected:"x".repeat(1501) }]) assert.throws(() => validatePilotFeedback({...example(),...patch}));
  assert.equal(validatePilotFeedback({...example(), submitted_by:"untrusted", reply_email:"someone@example.test"}).submitted_by, undefined);
});

function feedbackRoute(db) {
  const require = createRequire(import.meta.url);
  const source = readFileSync(new URL("../src/app/api/feedback/route.ts",import.meta.url),"utf8");
  const code = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  const output={exports:{}};
  new Function("require","module","exports",code)(name => name==="@/lib/supabase/server" ? {createSupabaseServerClient:async()=>db} : name==="@/lib/pilot-feedback" ? {validatePilotFeedback} : name==="@/lib/security/request-origin" ? {isSameOriginRequest} : require(name),output,output.exports);
  return output.exports.POST;
}
const request = (body, origin="https://joinonecircle.netlify.app") => new Request("https://joinonecircle.netlify.app/api/feedback",{method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify(body)});
test("feedback API requires a same-origin session and returns a saved receipt only after the secured RPC succeeds", async () => {
  let called;
  const db={auth:{getUser:async()=>({data:{user:{id:"caller"}}})},rpc:async(name,args)=>{called={name,args};return {data:"receipt",error:null};}};
  const post=feedbackRoute(db), payload={request_id:randomUUID(),answers:example()};
  assert.equal((await post(request(payload,"https://other.example"))).status,403);
  assert.equal((await feedbackRoute({auth:{getUser:async()=>({data:{user:null}})}})(request(payload))).status,401);
  assert.equal((await post(request({...payload,request_id:"not-uuid"}))).status,400);
  assert.equal(called,undefined);
  const result=await post(request(payload)); assert.equal(result.status,200); assert.deepEqual(await result.json(),{id:"receipt"});
  assert.equal(called.name,"submit_pilot_feedback"); assert.deepEqual(called.args.p_answers,example());
  assert.equal(Object.keys(called.args).includes("submitted_by"),false);
  db.rpc=async()=>({data:null,error:{message:"Feedback rate limit"}});
  assert.equal((await post(request(payload))).status,429);
});

test("feedback form has an explicit non-personal-data reminder and does not auto-upload files or copy invitation URLs", () => {
  const form=readFileSync(new URL("../src/components/pilot/pilot-feedback-form.tsx",import.meta.url),"utf8");
  assert.match(form,/privacy_confirmed/); assert.match(form,/allow_contact/);
  assert.match(form,/No screenshot or document is uploaded here/);
  assert.doesNotMatch(form,/type="file"|window\.location|localStorage|navigator\.userAgent/);
});

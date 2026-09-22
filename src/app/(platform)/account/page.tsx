import { signOut } from "../../auth/actions";
import { AccountSettings } from "./account-settings";
import { DemoAccountSettings } from "./demo-account-settings";
import { getPlatformContext } from "@/lib/platform-data";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const context = await getPlatformContext();
  const query = await searchParams;
  return <><header className="workspace-header"><div><p className="eyebrow">ACCOUNT</p><h1>Profile & security</h1><p>Manage your details, language and account protection.</p></div></header>{query.error && <p className="form-alert" role="alert">Your profile could not be saved. Check the name and try again.</p>}{query.message && <p className="notice" role="status">Profile saved.</p>}{context.demo ? <DemoAccountSettings /> : <AccountSettings name={context.userName} />}<section className="panel"><h2>Sign out</h2><p>End your session on this device.</p><form action={signOut}><button className="quiet-button" type="submit">Sign out</button></form></section></>;
}

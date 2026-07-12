import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AskForm from "@/components/AskForm";

export const metadata = {
  title: "Post a Prompt - Prompt Overflow",
};

export default async function AskPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <>
      <div className="main-content">
        <div className="page-header">
          <h1>Post a Prompt</h1>
        </div>
        <AskForm />
      </div>
      <div className="sidebar">
        <div className="yellow-box ask-hint-box">
          <h4>How to post</h4>
          <ul>
            <li>Share the exact prompt you used</li>
            <li>Include the link to what it built</li>
            <li>Describe what you expected and what you got</li>
            <li>Add tags so others can find it</li>
          </ul>
        </div>
      </div>
    </>
  );
}

import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.toLowerCase().trim();
  if (!q || q.length === 0) {
    return NextResponse.json([]);
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("username")
    .ilike("username", `${q}%`)
    .order("username")
    .limit(8);

  if (error) {
    return NextResponse.json([], { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

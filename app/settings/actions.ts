"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const USERNAME_RE = /^[a-z0-9-]{3,30}$/;

export type UpdateProfileInput = {
  username: string;
  display_name: string;
  location: string;
  website_url: string;
  about_me: string;
};

export type UpdateProfileResult = { error?: string };

export async function updateProfile(
  input: UpdateProfileInput
): Promise<UpdateProfileResult> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be logged in to update your profile." };
  }

  const username = input.username.trim().toLowerCase();

  if (!USERNAME_RE.test(username)) {
    return {
      error:
        "Username must be 3-30 characters: lowercase letters, numbers, and dashes only.",
    };
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      username,
      display_name: input.display_name.trim() || null,
      location: input.location.trim(),
      website_url: input.website_url.trim(),
      about_me: input.about_me.trim(),
    })
    .eq("id", user.id);

  if (updateError) {
    if (
      updateError.code === "23505" ||
      updateError.message.includes("duplicate key")
    ) {
      return { error: "That username is already taken." };
    }
    return { error: "Something went wrong saving your profile. Please try again." };
  }

  revalidatePath("/settings");
  revalidatePath("/users/" + username);

  return {};
}

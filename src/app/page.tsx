import { redirect } from "next/navigation";
import { getCurrentUser, defaultHomeFor } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(defaultHomeFor(user.role));
}

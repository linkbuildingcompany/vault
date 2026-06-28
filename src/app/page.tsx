import { redirect } from "next/navigation";

export default function Home() {
  redirect("/vault/client-approval-queue");
}

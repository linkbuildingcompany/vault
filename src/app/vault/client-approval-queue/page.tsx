// src/app/vault/client-approval-queue/page.tsx
// Approval queue has been removed — redirect to Introductions
import { redirect } from "next/navigation";

export default function ApprovalQueuePage() {
  redirect("/vault/introductions");
}

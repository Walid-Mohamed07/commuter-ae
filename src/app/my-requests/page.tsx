import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function MyRequestsRedirect() {
  redirect("/my-trips");
}

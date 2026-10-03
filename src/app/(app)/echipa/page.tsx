import { redirect } from "next/navigation";

// Echipă now lives inside Setări.
export default function EchipaPage() {
  redirect("/setari?tab=echipa");
}

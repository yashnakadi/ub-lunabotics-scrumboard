import { redirect } from "next/navigation";

/** The Scrum Board is the home page. The proxy sends signed-out visitors to /login. */
export default function HomePage() {
  redirect("/board");
}

import { createFileRoute } from "@tanstack/react-router";
import { AssignmentBuilder } from "@/builder/components/AssignmentBuilder";

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): { id?: string } => (typeof s["id"] === "string" ? { id: s["id"] as string } : {}),
  head: () => ({
    meta: [
      { title: "Assignment Builder · English Grades 6–8" },
      { name: "description", content: "Build English assignments for Grade 6–8 learners: sections, shared passages, matching pools and a student preview." },
      { property: "og:title", content: "Assignment Builder · English Grades 6–8" },
      { property: "og:description", content: "Teacher tool to compose and preview English assignments for Vietnamese learners." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const { id } = Route.useSearch();
  return <AssignmentBuilder {...(id ? { id } : {})} />;
}

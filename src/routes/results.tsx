import { createFileRoute } from "@tanstack/react-router";
import { ResultsPage } from "@/analytics/components/ResultsPage";

export const Route = createFileRoute("/results")({
  validateSearch: (s: Record<string, unknown>): { id?: string } => (typeof s["id"] === "string" ? { id: s["id"] as string } : {}),
  head: () => ({
    meta: [
      { title: "Kết quả bài làm · Assignment Builder" },
      { name: "description", content: "Class results for an English assignment: progress, scores, hardest questions, common wrong answers, sections and each student's work." },
      { property: "og:title", content: "Kết quả bài làm · Assignment Builder" },
      { property: "og:description", content: "See how the class did: progress, score spread, question-by-question results and each student's answers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Results,
});

function Results() {
  const { id } = Route.useSearch();
  return <ResultsPage {...(id ? { id } : {})} />;
}

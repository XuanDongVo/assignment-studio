import { createFileRoute } from "@tanstack/react-router";
import { ExamPlayer } from "@/attempts/components/ExamPlayer";

export const Route = createFileRoute("/student/$assignmentId")({
  head: () => ({
    meta: [
      { title: "Làm bài · English Grades 6–8" },
      { name: "description", content: "Full-screen official attempt: one try, autosave to the server, server-run timer and automatic submission when time is up." },
      { property: "og:title", content: "Làm bài · English Grades 6–8" },
      { property: "og:description", content: "Do your English assignment in full screen with autosave and a server-run timer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TakeAssignment,
});

function TakeAssignment() {
  const { assignmentId } = Route.useParams();
  return <ExamPlayer assignmentId={assignmentId} />;
}

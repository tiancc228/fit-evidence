import type { Exercise } from "@/src/lib/types";
import ExerciseHome from "@/src/components/exercise/ExerciseHome";

export default function ExerciseLibrary({
  onAnalyze,
  focusQuery,
}: {
  onAnalyze: (ex: Exercise) => void;
  focusQuery: { value: string; nonce: number } | null;
}) {
  return <ExerciseHome onAnalyze={onAnalyze} focusQuery={focusQuery} />;
}

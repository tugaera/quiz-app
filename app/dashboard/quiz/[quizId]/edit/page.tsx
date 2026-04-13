// app/dashboard/quiz/[quizId]/edit/page.tsx — Question editor
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { questionsFormSchema, type QuestionsFormInput } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DEFAULT_QUESTION = {
  text: "",
  answers: ["", ""],
  correctIndex: 0,
  timeLimitSeconds: 30,
};

export default function QuestionEditorPage() {
  const params = useParams<{ quizId: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [quizTitle, setQuizTitle] = useState("");

  const form = useForm<QuestionsFormInput>({
    resolver: zodResolver(questionsFormSchema),
    defaultValues: { questions: [{ ...DEFAULT_QUESTION }] },
  });

  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "questions",
  });

  const fetchQuestions = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();

    const { data: quiz } = await supabase
      .from("quizzes")
      .select("title")
      .eq("id", params.quizId)
      .single();
    setQuizTitle(quiz?.title ?? "");

    const { data: questions } = await supabase
      .from("questions")
      .select("*")
      .eq("quiz_id", params.quizId)
      .order("order_index", { ascending: true });

    if (questions && questions.length > 0) {
      form.reset({
        questions: questions.map((q) => ({
          id: q.id,
          text: q.text,
          answers: q.answers as string[],
          correctIndex: q.correct_index,
          timeLimitSeconds: q.time_limit_seconds,
        })),
      });
    }
    setLoading(false);
  }, [params.quizId, form]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // Unsaved changes warning
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (form.formState.isDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [form.formState.isDirty]);

  const onSubmit = async (data: QuestionsFormInput) => {
    setSaving(true);
    const supabase = getSupabaseBrowserClient();

    // Delete existing questions and re-insert all (simplest upsert strategy)
    await supabase
      .from("questions")
      .delete()
      .eq("quiz_id", params.quizId);

    const rows = data.questions.map((q, i) => ({
      quiz_id: params.quizId,
      text: q.text,
      answers: q.answers,
      correct_index: q.correctIndex,
      time_limit_seconds: q.timeLimitSeconds,
      order_index: i,
    }));

    const { error } = await supabase.from("questions").insert(rows);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Questions saved!");
      form.reset(data); // Clear dirty state
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Edit Questions</h1>
          <p className="text-muted-foreground">{quizTitle}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/dashboard/quiz/${params.quizId}`)}
          >
            Back
          </Button>
          <Button onClick={form.handleSubmit(onSubmit)} disabled={saving}>
            {saving ? "Saving..." : "Save All"}
          </Button>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {fields.map((field, qIndex) => (
          <Card key={field.id}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">
                Question {qIndex + 1}
              </CardTitle>
              <div className="flex gap-1">
                {qIndex > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => move(qIndex, qIndex - 1)}
                  >
                    Move Up
                  </Button>
                )}
                {qIndex < fields.length - 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => move(qIndex, qIndex + 1)}
                  >
                    Move Down
                  </Button>
                )}
                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => remove(qIndex)}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Question text */}
              <div className="space-y-2">
                <Label>Question Text</Label>
                <Input
                  placeholder="What is...?"
                  {...form.register(`questions.${qIndex}.text`)}
                />
                {form.formState.errors.questions?.[qIndex]?.text && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.questions[qIndex].text?.message}
                  </p>
                )}
              </div>

              {/* Answers */}
              <div className="space-y-2">
                <Label>Answer Options</Label>
                {form
                  .watch(`questions.${qIndex}.answers`)
                  ?.map((_: string, aIndex: number) => (
                    <div key={aIndex} className="flex items-center gap-2">
                      <Input
                        placeholder={`Option ${aIndex + 1}`}
                        {...form.register(
                          `questions.${qIndex}.answers.${aIndex}`
                        )}
                      />
                      {/* Remove answer button (if > 2) */}
                      {(form.watch(`questions.${qIndex}.answers`)?.length ??
                        0) > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const current = form.getValues(
                              `questions.${qIndex}.answers`
                            );
                            const updated = current.filter(
                              (_: string, i: number) => i !== aIndex
                            );
                            form.setValue(
                              `questions.${qIndex}.answers`,
                              updated,
                              { shouldDirty: true }
                            );
                            // Adjust correctIndex if needed
                            const ci = form.getValues(
                              `questions.${qIndex}.correctIndex`
                            );
                            if (ci >= updated.length) {
                              form.setValue(
                                `questions.${qIndex}.correctIndex`,
                                updated.length - 1,
                                { shouldDirty: true }
                              );
                            }
                          }}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                {(form.watch(`questions.${qIndex}.answers`)?.length ?? 0) <
                  4 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const current = form.getValues(
                        `questions.${qIndex}.answers`
                      );
                      form.setValue(
                        `questions.${qIndex}.answers`,
                        [...current, ""],
                        { shouldDirty: true }
                      );
                    }}
                  >
                    Add Option
                  </Button>
                )}
              </div>

              {/* Correct answer */}
              <div className="flex gap-4">
                <div className="space-y-2 flex-1">
                  <Label>Correct Answer</Label>
                  <Select
                    value={String(
                      form.watch(`questions.${qIndex}.correctIndex`)
                    )}
                    onValueChange={(val) =>
                      form.setValue(
                        `questions.${qIndex}.correctIndex`,
                        Number(val),
                        { shouldDirty: true }
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {form
                        .watch(`questions.${qIndex}.answers`)
                        ?.map((_: string, i: number) => (
                          <SelectItem key={i} value={String(i)}>
                            Option {i + 1}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Time limit */}
                <div className="space-y-2 w-32">
                  <Label>Time (sec)</Label>
                  <Input
                    type="number"
                    min={5}
                    max={60}
                    {...form.register(
                      `questions.${qIndex}.timeLimitSeconds`,
                      { valueAsNumber: true }
                    )}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => append({ ...DEFAULT_QUESTION })}
        >
          + Add Question
        </Button>
      </form>
    </div>
  );
}

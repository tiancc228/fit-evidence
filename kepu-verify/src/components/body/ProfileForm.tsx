import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Save, UserRound, Info } from "lucide-react";

import { useApp } from "@/src/lib/store";
import type { Activity, Goal, Profile, Sex } from "@/src/lib/types";
import { ACTIVITY_FACTOR, GOAL_LABEL } from "@/src/lib/calc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { InfoNote } from "@/src/components/body/shared";

const ACTIVITIES: Activity[] = ["sedentary", "light", "moderate", "high", "athlete"];
const GOALS: Goal[] = ["muscle", "fatloss", "recomp"];

const GOAL_HINT: Record<Goal, string> = {
  muscle: "增肌：小幅热量盈余 + 渐进超负荷，体重缓慢上升。",
  fatloss: "减脂：温和热量缺口 + 高蛋白保肌，体重缓慢下降。",
  recomp: "重塑：维持在消耗附近，同时增肌减脂，体重变化不大。",
};

const schema = z.object({
  name: z.string().trim().min(1, "请填写姓名或昵称").max(20, "名字请控制在 20 字以内"),
  sex: z.enum(["male", "female"], { required_error: "请选择性别" }),
  age: z.coerce.number({ invalid_type_error: "请填写数字" }).int("年龄需为整数").min(10, "年龄需在 10–100 之间").max(100, "年龄需在 10–100 之间"),
  heightCm: z.coerce.number({ invalid_type_error: "请填写数字" }).min(100, "身高需在 100–230 cm").max(230, "身高需在 100–230 cm"),
  weightKg: z.coerce.number({ invalid_type_error: "请填写数字" }).min(25, "体重需在 25–300 kg").max(300, "体重需在 25–300 kg"),
  bodyFatPct: z
    .string()
    .optional()
    .refine((v) => {
      if (v == null || v.trim() === "") return true;
      const n = Number(v);
      return Number.isFinite(n) && n >= 3 && n <= 60;
    }, "体脂率需在 3–60% 之间，或留空"),
  activity: z.enum(["sedentary", "light", "moderate", "high", "athlete"], { required_error: "请选择活动量" }),
  goal: z.enum(["muscle", "fatloss", "recomp"], { required_error: "请选择目标" }),
  trainingDaysPerWeek: z.coerce.number().int().min(0).max(7),
});

type FormValues = z.infer<typeof schema>;

function toFormValues(p: Profile | null): FormValues {
  return {
    name: p?.name ?? "",
    sex: p?.sex ?? "male",
    age: p?.age ?? 25,
    heightCm: p?.heightCm ?? 170,
    weightKg: p?.weightKg ?? 65,
    bodyFatPct: p?.bodyFatPct != null ? String(p.bodyFatPct) : "",
    activity: p?.activity ?? "light",
    goal: p?.goal ?? "recomp",
    trainingDaysPerWeek: p?.trainingDaysPerWeek ?? 3,
  };
}

export function ProfileForm({ onSaved }: { onSaved?: () => void }) {
  const { state, setProfile } = useApp();
  const profile = state.profile as Profile | null;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(profile),
    mode: "onBlur",
  });

  const lastSaved = React.useRef<string | null>(profile?.createdAt ?? null);
  React.useEffect(() => {
    if (profile && profile.createdAt !== lastSaved.current) {
      lastSaved.current = profile.createdAt;
      form.reset(toFormValues(profile));
    }
  }, [profile, form]);

  const activity = form.watch("activity");
  const goal = form.watch("goal");

  function onSubmit(values: FormValues) {
    const fatRaw = values.bodyFatPct?.trim();
    const next: Profile = {
      name: values.name.trim(),
      sex: values.sex as Sex,
      age: values.age,
      heightCm: values.heightCm,
      weightKg: values.weightKg,
      bodyFatPct: fatRaw ? Number(fatRaw) : null,
      activity: values.activity as Activity,
      goal: values.goal as Goal,
      trainingDaysPerWeek: values.trainingDaysPerWeek,
      createdAt: profile?.createdAt ?? new Date().toISOString(),
    };
    setProfile(next);
    lastSaved.current = next.createdAt;
    toast.success(profile ? "资料已更新，评估已重新计算" : "资料已保存，下方已生成你的身体评估");
    onSaved?.();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>姓名 / 昵称</FormLabel>
                <FormControl>
                  <Input placeholder="例如：小李" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="sex"
            render={({ field }) => (
              <FormItem>
                <FormLabel>性别</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="选择性别" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="male">男</SelectItem>
                    <SelectItem value="female">女</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>影响基础代谢与体脂参考区间。</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="age"
            render={({ field }) => (
              <FormItem>
                <FormLabel>年龄（岁）</FormLabel>
                <FormControl>
                  <Input type="number" inputMode="numeric" min={10} max={100} {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="heightCm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>身高（cm）</FormLabel>
                <FormControl>
                  <Input type="number" inputMode="decimal" step={0.5} min={100} max={230} {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="weightKg"
            render={({ field }) => (
              <FormItem>
                <FormLabel>体重（kg）</FormLabel>
                <FormControl>
                  <Input type="number" inputMode="decimal" step={0.1} min={25} max={300} {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="bodyFatPct"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  体脂率（%）<span className="font-normal text-muted-foreground">· 可空</span>
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step={0.1}
                    min={3}
                    max={60}
                    placeholder="不知道可留空"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormDescription>没有体脂秤可留空，后续在每日数据里补。</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="activity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>日常活动量</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="选择活动量" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ACTIVITIES.map((a) => (
                      <SelectItem key={a} value={a}>
                        {ACTIVITY_FACTOR[a].label}（×{ACTIVITY_FACTOR[a].factor}）
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>{ACTIVITY_FACTOR[activity as Activity]?.desc}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="goal"
            render={({ field }) => (
              <FormItem>
                <FormLabel>训练目标</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="选择目标" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {GOALS.map((g) => (
                      <SelectItem key={g} value={g}>
                        {GOAL_LABEL[g]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>{GOAL_HINT[goal as Goal]}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="trainingDaysPerWeek"
            render={({ field }) => (
              <FormItem>
                <FormLabel>每周计划训练天数</FormLabel>
                <Select onValueChange={(v) => field.onChange(Number(v))} value={String(field.value)}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="选择天数" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d} 天{d === 0 ? "（先养习惯）" : d >= 6 ? "（注意恢复）" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <InfoNote icon={Info}>
          资料仅保存在本机浏览器，用于计算 BMI、基础代谢、每日消耗与营养目标。公式与标准见下方评估卡片的标注。
        </InfoNote>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            <Save className="size-4" />
            {profile ? "更新资料" : "保存并生成评估"}
          </Button>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <UserRound className="size-3.5" />
            {profile ? `当前：${profile.name} · ${GOAL_LABEL[profile.goal]}` : "尚未填写资料"}
          </span>
        </div>
      </form>
    </Form>
  );
}

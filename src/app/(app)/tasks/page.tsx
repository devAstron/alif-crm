import { requireRole } from "@/lib/auth";
import { getTasksForUser } from "@/lib/tasks/queries";
import { PageHeader } from "@/components/page-header";
import { TaskList } from "@/components/tasks/task-list";
import { Bell } from "lucide-react";

export const metadata = { title: "Vazifalar — Alif CRM" };

export default async function TasksPage() {
  const user = await requireRole("ADMIN", "OPERATOR");
  const { pending, done, todayCount } = await getTasksForUser(user);

  return (
    <>
      <PageHeader title="Vazifalar" subtitle="Qayta aloqa va rejalashtirilgan ishlar" />

      {todayCount > 0 && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3.5">
          <Bell className="h-5 w-5 shrink-0 text-brand-600" />
          <p className="text-sm font-medium text-brand-800">
            Bugun {todayCount} ta lead bilan bog&apos;lanishingiz kerak
          </p>
        </div>
      )}

      <TaskList pending={pending} done={done} />
    </>
  );
}

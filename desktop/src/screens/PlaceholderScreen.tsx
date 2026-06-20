/**
 * PlaceholderScreen — stand-in content for screens not yet ported.
 *
 * Tasks 4-8 replace each of these with real screen components
 * (DashboardScreen, ReposScreen, GlossaryScreen, SettingsScreen,
 * UsageScreen, ConsoleScreen/ConsoleDrawer). This task (Task 3) only needs
 * something on-screen so nav click-through and the console drawer toggle
 * are visible; no real screen logic belongs here.
 */
import PageHeader from '../components/PageHeader';

export interface PlaceholderScreenProps {
  title: string;
}

export default function PlaceholderScreen({ title }: PlaceholderScreenProps) {
  return (
    <div>
      <PageHeader title={title} desc="占位页面 — 后续任务中实现。" />
    </div>
  );
}

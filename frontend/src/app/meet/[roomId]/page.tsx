import { PreJoinSetup } from "@/features/meeting/components/PreJoinSetup";

type PrejoinPageProps = {
  params: Promise<{
    roomId: string;
  }>;
};

export default async function PrejoinPage({ params }: PrejoinPageProps) {
  const { roomId } = await params;

  return (
    <main
      className="min-h-screen bg-background px-4 py-8 text-foreground"
      id="main-content"
    >
      <PreJoinSetup roomId={roomId} />
    </main>
  );
}

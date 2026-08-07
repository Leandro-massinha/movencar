import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button, Card, PageHeader } from "../components/ui";
const days = ["Seg 03", "Ter 04", "Qua 05", "Qui 06", "Sex 07", "Sab 08"];
const jobs = [
  ["08:00", "Honda Civic", "Revisão", "blue"],
  ["09:30", "Jeep Compass", "Diagnóstico", "amber"],
  ["11:00", "VW T-Cross", "Freios", "green"],
  ["14:00", "Toyota Corolla", "Suspensão", "blue"],
];
export function AgendaPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Agenda da oficina"
        description="Capacidade, agendamentos e entregas em uma única visão"
        action={
          <Button>
            <Plus className="size-4" />
            Novo agendamento
          </Button>
        }
      />
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div className="flex items-center gap-2">
            <Button variant="secondary">
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="secondary">
              <ChevronRight className="size-4" />
            </Button>
            <strong>3 a 8 de agosto de 2026</strong>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary">Hoje</Button>
            <Button>Semana</Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="grid min-w-[900px] grid-cols-[80px_repeat(6,1fr)]">
            <div className="border-b border-r p-3" />
            {days.map((d) => (
              <div
                key={d}
                className="border-b border-r p-3 text-center text-sm font-semibold"
              >
                {d}
              </div>
            ))}
            {["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"].map(
              (time, row) => (
                <div key={time} className="contents">
                  <div className="h-24 border-b border-r p-3 text-xs text-slate-500">
                    {time}
                  </div>
                  {days.map((d, col) => (
                    <div
                      key={d}
                      className="relative h-24 border-b border-r p-2"
                    >
                      {col === row % 4 && jobs[row % jobs.length] && (
                        <div className="rounded-md border-l-4 border-brand-500 bg-blue-50 p-2 text-xs">
                          <strong>{jobs[row % jobs.length][1]}</strong>
                          <br />
                          {jobs[row % jobs.length][2]}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ),
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

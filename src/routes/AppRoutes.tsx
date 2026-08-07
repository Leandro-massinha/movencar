import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppLayout } from "../layouts/AppLayout";
import { useAuth } from "../hooks/useAuth";
import { hasPermission } from "../lib/permissions";
import type { Permission } from "../types/auth";
import { LoginPage } from "../pages/LoginPage";
import { DashboardPage } from "../pages/DashboardPage";
import { AgendaPage } from "../pages/AgendaPage";
import { FinancePage } from "../pages/FinancePage";
import { ListPage } from "../pages/ListPage";
import { SessionEndedPage } from "../pages/SessionEndedPage";
import { CustomersPage } from "../pages/CustomersPage";
import { VehiclesPage } from "../pages/VehiclesPage";
import { VehicleHistoryPage } from "../pages/VehicleHistoryPage";
import { hasModule, moduleForPermission } from "../lib/moduleAccess";
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { authenticated, initializing } = useAuth();
  const loc = useLocation();
  if (initializing)
    return (
      <div className="grid min-h-screen place-items-center bg-canvas text-sm text-slate-500">
        Carregando sessão...
      </div>
    );
  return authenticated ? (
    <>{children}</>
  ) : (
    <Navigate to="/login" state={{ from: loc.pathname }} replace />
  );
}
export function PermissionRoute({
  permission,
  children,
}: {
  permission: Permission;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  return hasPermission(user, permission) ? (
    <>{children}</>
  ) : (
    <Navigate to="/sem-acesso" replace />
  );
}
export const ModulePermissionRoute = ({
  p,
  children,
}: {
  p: Permission;
  children: React.ReactNode;
}) => {
  const { tenant } = useAuth();
  return hasModule(tenant, moduleForPermission(p)) ? (
    <PermissionRoute permission={p}>{children}</PermissionRoute>
  ) : (
    <Navigate to="/sem-acesso" replace />
  );
};
const Guard = ModulePermissionRoute;
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/sessao-encerrada" element={<SessionEndedPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route
          index
          element={
            <Guard p="dashboard.view">
              <DashboardPage />
            </Guard>
          }
        />
        <Route
          path="agenda"
          element={
            <Guard p="agenda.view">
              <AgendaPage />
            </Guard>
          }
        />
        <Route
          path="veiculos"
          element={
            <Guard p="vehicles.view">
              <VehiclesPage />
            </Guard>
          }
        />
        <Route
          path="veiculos/:id/historico"
          element={
            <Guard p="vehicle_history.view">
              <VehicleHistoryPage />
            </Guard>
          }
        />
        <Route
          path="ordens-servico"
          element={
            <Guard p="orders.view">
              <ListPage
                title="Ordens de Serviço"
                description="Do orçamento à entrega do veículo"
                action="Nova ordem"
              />
            </Guard>
          }
        />
        <Route
          path="financeiro"
          element={
            <Guard p="finance.view">
              <FinancePage />
            </Guard>
          }
        />
        <Route
          path="clientes"
          element={
            <Guard p="customers.view">
              <CustomersPage />
            </Guard>
          }
        />
        <Route path="crm" element={<Navigate to="/clientes" replace />} />
        <Route
          path="patio"
          element={
            <Guard p="yard.view">
              <ListPage
                title="Pátio"
                description="Localização e situação de cada veículo"
                action="Registrar entrada"
              />
            </Guard>
          }
        />
        <Route
          path="ferramentas"
          element={
            <Guard p="tools.view">
              <ListPage
                title="Ferramentas"
                description="Empréstimos, manutenções e inventário"
                action="Nova ferramenta"
              />
            </Guard>
          }
        />
        <Route
          path="centros-custo"
          element={
            <Guard p="finance.view">
              <ListPage
                title="Centros de Custos"
                description="Distribuição gerencial de despesas e receitas"
                action="Novo centro"
              />
            </Guard>
          }
        />
        <Route
          path="avaliacoes"
          element={
            <Guard p="crm.view">
              <ListPage
                title="Avaliações"
                description="Satisfação, reputação e planos de recuperação"
                empty
              />
            </Guard>
          }
        />
        <Route
          path="checklists"
          element={
            <Guard p="orders.view">
              <ListPage
                title="Modelos de Lista de Verificação"
                description="Padronize inspeções e entregas"
                action="Novo modelo"
              />
            </Guard>
          }
        />
        <Route
          path="configuracoes"
          element={
            <Guard p="settings.manage">
              <ListPage
                title="Configurações"
                description="Empresa, filiais, usuários e integrações"
                action="Convidar usuário"
              />
            </Guard>
          }
        />
        <Route
          path="sem-acesso"
          element={
            <ListPage
              title="Acesso negado"
              description="Você não possui permissão ou o módulo não está disponível para esta empresa."
              empty
            />
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

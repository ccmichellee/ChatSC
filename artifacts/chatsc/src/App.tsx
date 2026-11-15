import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { Shell } from '@/components/shell';
import Home from '@/pages/home';
import Events from '@/pages/events';
import MapPage from '@/pages/map';
import CalendarPage from '@/pages/calendar';
import Clubs from '@/pages/clubs';
import Opportunities from '@/pages/opportunities';
import Onboarding from '@/pages/onboarding';
import { PrivacyPage, TermsPage } from '@/pages/legal';
import { TojiProvider } from '@/components/toji';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

function Router() {
  return (
    <Shell>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/events" component={Events} />
          <Route path="/map" component={MapPage} />
          <Route path="/calendar" component={CalendarPage} />
          <Route path="/clubs" component={Clubs} />
          <Route path="/opportunities" component={Opportunities} />
          <Route path="/onboarding" component={Onboarding} />
          <Route path="/privacy" component={PrivacyPage} />
          <Route path="/terms" component={TermsPage} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </Shell>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <TojiProvider>
            <Router />
          </TojiProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

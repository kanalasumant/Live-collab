import { Switch, Route } from "wouter";
import { SocketProvider } from "@/context/SocketContext";
import { AppProvider } from "@/context/AppContext";
import Home from "@/pages/Home";
import Canvas from "@/pages/Canvas";
import Toast from "@/components/Toast/Toast";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/canvas" component={Canvas} />
    </Switch>
  );
}

export default function App() {
  return (
    <SocketProvider>
      <AppProvider>
        <Router />
        <Toast />
      </AppProvider>
    </SocketProvider>
  );
}

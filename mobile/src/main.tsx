import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import WebVaultDashboard from "@/app/page";
import { PricingClient } from "@/components/pricing-client";
import "@/app/globals.css";
import { initialiseNativeApp } from "@/lib/native-app";

type MobileRoute = "home" | "pricing";

function currentRoute(): MobileRoute {
  return window.location.hash === "#pricing" ? "pricing" : "home";
}

function MobileApp() {
  const [route, setRoute] = useState<MobileRoute>(currentRoute);

  useEffect(() => {
    const updateRoute = () => setRoute(currentRoute());
    window.addEventListener("hashchange", updateRoute);
    return () => window.removeEventListener("hashchange", updateRoute);
  }, []);

  return route === "pricing" ? <PricingClient /> : <WebVaultDashboard />;
}

void initialiseNativeApp();

createRoot(document.getElementById("root")!).render(<MobileApp />);

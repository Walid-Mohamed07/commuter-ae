import AppHeader from "@/components/layout/AppHeader";
import Hero from "@/components/landing/Hero";
import HowItWorks from "@/components/landing/HowItWorks";
import VehicleTypes from "@/components/landing/VehicleTypes";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/layout/Footer";
import { getSession } from "@/lib/auth/session";

export default async function Home() {
  const session = await getSession();
  return (
    <>
      <AppHeader authed={!!session} email={session?.email} variant="landing" />
      <main>
        <Hero />
        <HowItWorks />
        <VehicleTypes />
        <CTA />
      </main>
      <Footer />
    </>
  );
}

import Header from "@/components/layout/Header";
import Hero from "@/components/landing/Hero";
import HowItWorks from "@/components/landing/HowItWorks";
import VehicleTypes from "@/components/landing/VehicleTypes";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/layout/Footer";

export default function Home() {
  return (
    <>
      <Header />
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

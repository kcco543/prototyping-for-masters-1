// Grain Light Card: a holographic tarot card whose engraved lines flash with
// rainbow light as you tilt it. The card itself is a reusable component in
// components/ui/grain-light-card.tsx; this page shows its demo
// (GrainLightCardDemo.tsx) with a panel of controls to play with.

import type { Metadata } from "next";
import BackHome from "../../components/back-home/BackHome";
import GrainLightCardDemo from "./GrainLightCardDemo";
import styles from "./styles.module.css";

export const metadata: Metadata = {
  title: "Grain Light Card",
  description: "A holographic tarot card whose engraved lines flash as the light crosses them.",
};

export default function GrainLightCardPage() {
  return (
    <div className={styles.page}>
      <div className={styles.backHome}>
        <BackHome accent="#8e8bff" surface="#f7f7fa" ink="#17162a" />
      </div>
      <GrainLightCardDemo />
    </div>
  );
}

import type { Metadata } from "next";
import HouseholdApp from "./HouseholdApp";

export const metadata: Metadata = {
  title: "Household Load Balancer | SOR7ED",
  description: "Make the invisible household work visible and share responsibilities fairly.",
};

export default function HouseholdPage() {
  return <HouseholdApp />;
}

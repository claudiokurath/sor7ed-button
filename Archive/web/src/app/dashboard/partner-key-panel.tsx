"use client";
import { useState } from "react";
import { EmbedSnippet } from "./embed-snippet";
import { RotateKeyButton } from "./rotate-key-button";

// Owns the apiKey state so a rotation updates the embed snippet in place
// without a full page reload. DashboardPage is a Server Component and
// can't hold this state itself, so this is the client boundary both
// EmbedSnippet and RotateKeyButton render inside of.
export function PartnerKeyPanel({ initialApiKey, buttonLabel }: { initialApiKey: string; buttonLabel: string }) {
  const [apiKey, setApiKey] = useState(initialApiKey);

  return (
    <div>
      <EmbedSnippet apiKey={apiKey} buttonLabel={buttonLabel} />
      <RotateKeyButton onRotated={setApiKey} />
    </div>
  );
}

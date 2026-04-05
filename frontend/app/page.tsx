"use client";

import { useMemo, useState } from "react";
import Chat from "./Chat";

type Condition = "AI" | "Writing";

export default function Page() {
  const [participant, setParticipant] = useState("");
  const [condition, setCondition] = useState<Condition>("AI");
  const [started, setStarted] = useState(false);

  const participantTrimmed = useMemo(() => participant.trim(), [participant]);

  if (started) {
    return (
      <Chat participant={participantTrimmed} condition={condition} />
    );
  }

  return (
    <main style={{ padding: 40, maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>
        Study Chat
      </h1>

      <div style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Participant ID</span>
          <input
            value={participant}
            onChange={(e) => setParticipant(e.target.value)}
            placeholder="e.g. P001"
            style={{ width: "100%", padding: 10, border: "1px solid gray" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Condition</span>
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value as Condition)}
            style={{ width: "100%", padding: 10, border: "1px solid gray" }}
          >
            <option value="AI">AI</option>
            <option value="Writing">Writing</option>
          </select>
        </label>

        <button
          onClick={() => setStarted(true)}
          disabled={!participantTrimmed}
          style={{ padding: 12, marginTop: 8 }}
        >
          Start (5 minutes)
        </button>

        <p style={{ opacity: 0.75, marginTop: 8, lineHeight: 1.5 }}>
          You must enter a Participant ID before starting. The 5-minute timer
          begins when the session starts.
        </p>
      </div>
    </main>
  );
}
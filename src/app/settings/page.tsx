"use client";

import { useState, useEffect } from "react";
import { Save, Plus, X, Tv, Shield, Ban } from "lucide-react";

interface StreamingService {
  id: number;
  name: string;
  logoPath: string | null;
  active: boolean;
}

export default function SettingsPage() {
  const [services, setServices] = useState<StreamingService[]>([]);
  const [blockedWords, setBlockedWords] = useState<string[]>([]);
  const [newWord, setNewWord] = useState("");
  const [maxLanguage, setMaxLanguage] = useState(2);
  const [maxViolence, setMaxViolence] = useState(3);
  const [maxSexual, setMaxSexual] = useState(1);
  const [maxScary, setMaxScary] = useState(2);
  const [maxMpaa, setMaxMpaa] = useState("PG");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/user/services").then((r) => r.json()),
      fetch("/api/user/blocked-words").then((r) => r.json()),
    ])
      .then(([servicesData, wordsData]) => {
        setServices(servicesData.services || []);
        setBlockedWords(wordsData.words || []);
        if (servicesData.filterProfile) {
          const p = servicesData.filterProfile;
          setMaxLanguage(p.maxLanguageScore ?? 2);
          setMaxViolence(p.maxViolenceScore ?? 3);
          setMaxSexual(p.maxSexualContentScore ?? 1);
          setMaxScary(p.maxScaryScore ?? 2);
          setMaxMpaa(p.maxMpaa ?? "PG");
        }
      })
      .catch(() => {});
  }, []);

  const toggleService = (id: number) => {
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s))
    );
  };

  const addBlockedWord = () => {
    const word = newWord.trim().toLowerCase();
    if (word && !blockedWords.includes(word)) {
      setBlockedWords((prev) => [...prev, word]);
      setNewWord("");
    }
  };

  const removeBlockedWord = (word: string) => {
    setBlockedWords((prev) => prev.filter((w) => w !== word));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      await Promise.all([
        fetch("/api/user/services", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            services: services
              .filter((s) => s.active)
              .map((s) => s.id),
          }),
        }),
        fetch("/api/user/blocked-words", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ words: blockedWords }),
        }),
      ]);
      setMessage("Settings saved!");
      setTimeout(() => setMessage(""), 3000);
    } catch {
      setMessage("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const MPAA_OPTIONS = ["G", "PG", "PG-13", "R"];

  return (
    <div className="container mx-auto px-4 max-w-3xl py-6">
      <h1 className="text-2xl md:text-3xl font-bold mb-8">Settings</h1>

      {/* Streaming Services */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Tv className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">My Streaming Services</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Select the services you subscribe to. Movies will be filtered to show
          only what&apos;s available on your services.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {services.map((service) => (
            <button
              key={service.id}
              onClick={() => toggleService(service.id)}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                service.active
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              <div
                className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                  service.active
                    ? "border-primary bg-primary"
                    : "border-muted-foreground"
                }`}
              >
                {service.active && (
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>
              <span className="text-sm font-medium">{service.name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Content Filters */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Content Filter Thresholds</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Set the maximum content score (0-5) for each category. Movies
          exceeding these levels will be flagged or hidden.
        </p>

        <div className="space-y-6">
          <SliderSetting
            label="Max Language"
            value={maxLanguage}
            onChange={setMaxLanguage}
          />
          <SliderSetting
            label="Max Violence"
            value={maxViolence}
            onChange={setMaxViolence}
          />
          <SliderSetting
            label="Max Sexual Content"
            value={maxSexual}
            onChange={setMaxSexual}
          />
          <SliderSetting
            label="Max Scary/Intense"
            value={maxScary}
            onChange={setMaxScary}
          />

          <div>
            <label className="block text-sm font-medium mb-2">
              Max MPAA Rating
            </label>
            <div className="flex gap-2">
              {MPAA_OPTIONS.map((rating) => (
                <button
                  key={rating}
                  onClick={() => setMaxMpaa(rating)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    maxMpaa === rating
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {rating}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Blocked Words */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Ban className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Blocked Words</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Movies containing any of these words in their content advisory will be
          automatically filtered out.
        </p>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addBlockedWord()}
            placeholder="Add a word to block..."
            className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-sm"
          />
          <button
            onClick={addBlockedWord}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {blockedWords.map((word) => (
            <span
              key={word}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-destructive/10 text-destructive text-sm"
            >
              {word}
              <button
                onClick={() => removeBlockedWord(word)}
                className="hover:bg-destructive/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {blockedWords.length === 0 && (
            <p className="text-sm text-muted-foreground">No blocked words set.</p>
          )}
        </div>
      </section>

      {/* Save */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save Settings"}
        </button>
        {message && (
          <span
            className={`text-sm ${message.includes("Failed") ? "text-destructive" : "text-score-green"}`}
          >
            {message}
          </span>
        )}
      </div>
    </div>
  );
}

function SliderSetting({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const colors = ["bg-score-green", "bg-score-green", "bg-score-yellow", "bg-score-yellow", "bg-score-orange", "bg-score-red"];
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium">{label}</label>
        <span
          className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold text-white ${colors[value]}`}
        >
          {value}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-muted accent-primary"
      />
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        <span>None</span>
        <span>Extreme</span>
      </div>
    </div>
  );
}

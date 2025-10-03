import React, { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

export default function MagicChessPredictorSeason3() {
  const [opponents, setOpponents] = useState(() => {
    try {
      const raw = localStorage.getItem("mc_season3_data");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [newOpponent, setNewOpponent] = useState("");
  const [result, setResult] = useState("win");
  const [note, setNote] = useState("");
  const [prediction, setPrediction] = useState(null);
  const [seedRandomness, setSeedRandomness] = useState(0);
  const [selectedOpponent, setSelectedOpponent] = useState(null);

  useEffect(() => {
    localStorage.setItem("mc_season3_data", JSON.stringify(opponents));
  }, [opponents]);

  function addRecord(name, resultVal = "win", noteVal = "") {
    if (!name.trim()) return;
    const record = {
      id: Date.now() + Math.random(),
      name: name.trim(),
      result: resultVal,
      note: noteVal,
      timestamp: new Date().toISOString(),
    };
    setOpponents((prev) => [record, ...prev]);
  }

  function computePredictionsSmart() {
    if (opponents.length === 0) return null;

    const now = Date.now();
    const decayFactor = 0.95;

    const agg = {};
    opponents.forEach((r, i) => {
      const name = r.name;
      const ageFactor = Math.pow(decayFactor, i / 3);
      if (!agg[name]) agg[name] = { count: 0, score: 0, recentLoss: 0, timestamps: [] };
      agg[name].count += ageFactor;
      agg[name].timestamps.push(new Date(r.timestamp).getTime());
      if (r.result === "win") agg[name].score += 1 * ageFactor;
      else if (r.result === "loss") {
        agg[name].score -= 1 * ageFactor;
        if (i < 5) agg[name].recentLoss += 1;
      }
    });

    const names = Object.keys(agg);
    const maxCount = Math.max(...names.map((n) => agg[n].count));

    const results = names.map((name) => {
      const avgScore = agg[name].score / agg[name].count;
      const timeBoost =
        (now - Math.min(...agg[name].timestamps)) / (1000 * 60 * 60 * 24);
      const recencyScore = 1 / (1 + timeBoost / 10);
      const trendBoost = Math.min(1, agg[name].recentLoss / 3);
      const base =
        (agg[name].count / maxCount) * 0.4 +
        recencyScore * 0.4 +
        (1 - avgScore) * 0.2;
      const adjusted = base * (1 + trendBoost * 0.5);
      return { name, prob: adjusted };
    });

    const sum = results.reduce((a, b) => a + b.prob, 0) || 1;
    const normalized = results.map((r) => ({ ...r, finalProb: r.prob / sum }));

    const temp = Math.max(0.1, 1 + seedRandomness / 10);
    const withTemp = normalized.map((r) => ({
      ...r,
      finalProb: Math.pow(r.finalProb, 1 / temp),
    }));
    const total = withTemp.reduce((a, b) => a + b.finalProb, 0);
    const final = withTemp.map((r) => ({
      ...r,
      finalProb: r.finalProb / total,
    }));

    return final.sort((a, b) => b.finalProb - a.finalProb);
  }

  function runPredict() {
    const preds = computePredictionsSmart();
    if (!preds) return setPrediction(null);
    setPrediction({ list: preds, picked: preds[0] });
  }

  function clearData() {
    if (confirm("Hapus semua data?")) {
      setOpponents([]);
      localStorage.removeItem("mc_season3_data");
      setPrediction(null);
      setSelectedOpponent(null);
    }
  }

  const opponentsByName = useMemo(() => {
    const m = {};
    const data = [...opponents].reverse();
    data.forEach((r) => {
      if (!m[r.name]) m[r.name] = [];
      m[r.name].push({
        timestamp: new Date(r.timestamp).getTime(),
        result: r.result,
      });
    });
    return m;
  }, [opponents]);

  function buildPerformanceSeries(name, points = 20) {
    const arr = opponentsByName[name] || [];
    if (arr.length === 0) return [];
    const numeric = arr.map((a) => ({
      t: a.timestamp,
      v: a.result === "win" ? 1 : a.result === "loss" ? -1 : 0,
    }));
    const series = [];
    let cum = 0;
    for (let i = 0; i < numeric.length; i++) {
      cum += numeric[i].v;
      const avg = cum / (i + 1);
      series.push({
        time: new Date(numeric[i].t).toLocaleDateString(),
        avg: Number(avg.toFixed(3)),
        raw: numeric[i].v,
      });
    }
    return series.slice(-points);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto font-sans text-gray-900">
      <h1 className="text-3xl font-bold mb-2">
        Magic Chess Predictor — Season 3 (Smart + Chart)
      </h1>
      <p className="text-gray-600 mb-6">
        Model prediksi telah ditingkatkan dan sekarang menampilkan grafik
        performa lawan dari waktu ke waktu.
      </p>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="md:col-span-2 bg-white p-4 rounded-xl shadow">
          <h2 className="font-semibold mb-2">Tambah Riwayat Pertandingan</h2>
          <div className="flex gap-2 mb-3">
            <input
              value={newOpponent}
              onChange={(e) => setNewOpponent(e.target.value)}
              placeholder="Nama lawan"
              className="border p-2 rounded flex-1"
            />
            <select
              value={result}
              onChange={(e) => setResult(e.target.value)}
              className="border p-2 rounded"
            >
              <option value="win">Win</option>
              <option value="loss">Loss</option>
              <option value="draw">Draw</option>
              <option value="unknown">Unknown</option>
            </select>
            <button
              onClick={() => {
                addRecord(newOpponent, result, note);
                setNewOpponent("");
                setNote("");
              }}
              className="bg-sky-600 text-white px-3 py-2 rounded"
            >
              Tambah
            </button>
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Catatan (opsional)"
            className="border p-2 rounded w-full"
          />

          <div className="mt-4 flex gap-2">
            <button
              onClick={runPredict}
              className="flex-1 bg-emerald-600 text-white px-3 py-2 rounded"
            >
              Jalankan Prediksi
            </button>
            <button
              onClick={clearData}
              className="flex-1 bg-red-500 text-white px-3 py-2 rounded"
            >
              Hapus Semua
            </button>
          </div>
        </div>

        <aside className="bg-white p-4 rounded-xl shadow">
          <h3 className="font-semibold">Kontrol</h3>
          <label className="text-sm text-gray-700">Seed randomness (-5..5)</label>
          <input
            type="number"
            value={seedRandomness}
            onChange={(e) => setSeedRandomness(Number(e.target.value))}
            className="border p-2 rounded w-full mt-1"
            min={-5}
            max={5}
          />
        </aside>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-white p-4 rounded-xl shadow">
          <h2 className="font-semibold">Hasil Prediksi</h2>
          {prediction ? (
            <div className="mt-3">
              <p className="text-lg">
                Top pick:{" "}
                <span className="font-bold">{prediction.picked.name}</span> —{" "}
                {(prediction.picked.finalProb * 100).toFixed(2)}%
              </p>
              <div className="mt-3 overflow-auto max-h-48">
                <table className="w-full text-sm">
                  <thead className="text-gray-500">
                    <tr>
                      <th>Nama</th>
                      <th>Prob</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {prediction.list.map((p) => (
                      <tr key={p.name} className="border-t">
                        <td className="py-1">{p.name}</td>
                        <td className="py-1">
                          {(p.finalProb * 100).toFixed(2)}%
                        </td>
                        <td className="py-1">
                          <button
                            className="text-sm text-sky-600"
                            onClick={() => setSelectedOpponent(p.name)}
                          >
                            Lihat Grafik
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-gray-600">Jalankan prediksi untuk melihat hasil.</p>
          )}
        </div>

        <div className="bg-white p-4 rounded-xl shadow">
          <h2 className="font-semibold">Grafik Performa</h2>
          {selectedOpponent ? (
            (() => {
              const series = buildPerformanceSeries(selectedOpponent, 30);
              if (!series || series.length === 0)
                return <p className="text-gray-600">Tidak ada data untuk {selectedOpponent}.</p>;
              return (
                <div style={{ width: "100%", height: 260 }}>
                  <ResponsiveContainer>
                    <LineChart
                      data={series}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" minTickGap={10} />
                      <YAxis domain={[-1, 1]} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="avg"
                        stroke="#8884d8"
                        strokeWidth={2}
                        dot={{ r: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="mt-2 text-sm text-gray-600">
                    Menampilkan rata-rata kumulatif hasil ({selectedOpponent}).
                    Win=+1, Draw=0, Loss=-1.
                  </div>
                </div>
              );
            })()
          ) : (
            <p className="text-gray-600">
              Pilih lawan dari daftar prediksi ("Lihat Grafik") untuk menampilkan
              performa mereka.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
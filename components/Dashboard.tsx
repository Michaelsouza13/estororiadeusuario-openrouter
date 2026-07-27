
import React from 'react';
import { AnalysisResult } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

interface DashboardProps {
  results: AnalysisResult[];
}

const Dashboard: React.FC<DashboardProps> = ({ results }) => {
  if (results.length === 0) return null;

  const total = results.length;
  const avgScore = results.reduce((acc, curr) => acc + curr.totalScore, 0) / total;
  
  // Adjusted for max score of 9
  const scoreDistribution = [
    { name: 'Ruim (0-4)', value: results.filter(r => r.totalScore <= 4).length, color: '#ef4444' },
    { name: 'Médio (5-7)', value: results.filter(r => r.totalScore > 4 && r.totalScore <= 7).length, color: '#eab308' },
    { name: 'Bom (8-9)', value: results.filter(r => r.totalScore > 7).length, color: '#22c55e' },
  ].filter(d => d.value > 0);

  const criteriaAvg = [
    { name: 'Persona', score: results.reduce((acc, r) => acc + r.criteriaScores.persona, 0) / total, max: 3 },
    { name: 'Ação', score: results.reduce((acc, r) => acc + r.criteriaScores.action, 0) / total, max: 3 },
    { name: 'Estrutura', score: results.reduce((acc, r) => acc + r.criteriaScores.structure, 0) / total, max: 3 },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      {/* Summary Card */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-center items-center">
        <h3 className="text-gray-500 font-medium mb-2">Média Geral</h3>
        <div className="text-5xl font-bold text-gray-800">{avgScore.toFixed(1)}</div>
        <div className="text-sm text-gray-400 mt-2">Em {total} histórias (Max 9)</div>
      </div>

      {/* Distribution Chart */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-gray-700 font-semibold mb-4 text-sm uppercase tracking-wide">Distribuição de Qualidade</h3>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={scoreDistribution}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={60}
                paddingAngle={5}
                dataKey="value"
              >
                {scoreDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-4 text-xs mt-2">
            {scoreDistribution.map(d => (
                <div key={d.name} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{backgroundColor: d.color}}></div>
                    <span>{d.name} ({d.value})</span>
                </div>
            ))}
        </div>
      </div>

      {/* Weakness Analysis */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-gray-700 font-semibold mb-4 text-sm uppercase tracking-wide">Desempenho por Critério (Média)</h3>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={criteriaAvg} layout="vertical">
              <XAxis type="number" hide domain={[0, 3]} />
              <YAxis dataKey="name" type="category" width={70} tick={{fontSize: 12}} />
              <Tooltip />
              <Bar dataKey="score" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

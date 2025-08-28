"use client";

import type { NextPage } from "next";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useUniswapPositions } from "~~/services/uniswap/positions";

const data = [
  {
    name: "Page A",
    uv: 4000,
    pv: 2400,
    amt: 2400,
  },
  {
    name: "Page B",
    uv: 3000,
    pv: 1398,
    amt: 2210,
  },
  {
    name: "Page C",
    uv: 2000,
    pv: 9800,
    amt: 2290,
  },
  {
    name: "Page D",
    uv: 2780,
    pv: 3908,
    amt: 2000,
  },
  {
    name: "Page E",
    uv: 1890,
    pv: 4800,
    amt: 2181,
  },
  {
    name: "Page F",
    uv: 2390,
    pv: 3800,
    amt: 2500,
  },
  {
    name: "Page G",
    uv: 3490,
    pv: 4300,
    amt: 2100,
  },
];

const Home: NextPage = () => {
  const { data: uniswapData } = useUniswapPositions();

  console.log({ uniswapData });
  return (
    <section className="container mx-auto py-8 px-4">
      <div>
        <h1 className="text-3xl font-bold text-primary-content">Portfolio Overview</h1>
        <p className="text-secondary-content mt-1">Monitor your DeFi positions across multiple protocols</p>
      </div>

      <div className="grid md:grid-cols-4 grid-cols-2 gap-4 mt-12">
        <div className="card gradient-border-red card-compact shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-sm">Total Portfolio Value</h2>
            <p className="text-2xl font-bold">$45,672.34</p>
          </div>
        </div>
        <div className="card gradient-border-red card-compact shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-sm">24h Yield</h2>
            <p className="text-2xl font-bold">$45,672.34</p>
          </div>
        </div>
        <div className="card gradient-border-red card-compact shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-sm">Average APY</h2>
            <p className="text-2xl font-bold">$45,672.34</p>
          </div>
        </div>
        <div className="card gradient-border-red card-compact shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-sm">Active Positions</h2>
            <p className="text-2xl font-bold">3</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 mt-6">
        <div className="card gradient-border-red card-compact shadow-sm h-[400px]">
          <div className="card-body">
            <h2 className="card-title text-sm mb-4">Portfolio Analytics</h2>
            <ResponsiveContainer width="100%" height="100%" className="pt-4">
              <AreaChart
                width={500}
                height={400}
                data={data}
                margin={{
                  top: 10,
                  right: 30,
                  left: 0,
                  bottom: 0,
                }}
              >
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="uv" stroke="#8884d8" fill="#8884d8" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-12">
        <h1 className="text-3xl font-bold text-primary-content">Protocol Positions</h1>
        <p className="text-secondary-content mt-1">Monitor your DeFi positions across multiple protocols</p>
      </div>

      <div className="card bg-base-100 shadow-sm mt-6">
        <div className="card-body overflow-x-auto">
          <table className="table">
            {/* head */}
            <thead>
              <tr className="border-b border-base-200/20">
                <th>Protocol</th>
                <th>Asset/Pair</th>
                <th>Value</th>
                <th>24h Yield</th>
                <th>7d Yield</th>
                <th>APY</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

export default Home;

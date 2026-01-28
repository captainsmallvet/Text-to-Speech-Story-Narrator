
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface WaveformVisualizerProps {
  audioBuffer: AudioBuffer | null;
}

const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({ audioBuffer }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!audioBuffer || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = 120;
    
    svg.selectAll("*").remove();

    const data = audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const filteredData: number[] = [];
    
    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = data[(i * step) + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      filteredData.push(max - min);
    }

    const x = d3.scaleLinear().domain([0, filteredData.length]).range([0, width]);
    const y = d3.scaleLinear().domain([0, d3.max(filteredData) || 1]).range([height, 0]);

    svg.append("g")
      .attr("fill", "#6366f1")
      .selectAll("rect")
      .data(filteredData)
      .join("rect")
      .attr("x", (d, i) => x(i))
      .attr("y", d => y(d))
      .attr("width", 1)
      .attr("height", d => height - y(d));

  }, [audioBuffer]);

  return (
    <div className="w-full h-[120px] bg-slate-900/50 rounded-lg overflow-hidden relative">
      {!audioBuffer && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm italic">
          No audio generated yet
        </div>
      )}
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
};

export default WaveformVisualizer;

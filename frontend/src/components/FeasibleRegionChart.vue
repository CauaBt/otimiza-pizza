<template>
  <div class="chart-container">
    <canvas ref="chartCanvas"></canvas>
  </div>
</template>

<script>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { Chart, registerables } from 'chart.js';

// Register Chart.js components
Chart.register(...registerables);

export default {
  name: 'FeasibleRegionChart',
  props: {
    vertices: {
      type: Array,
      required: true,
      default: () => []
    },
    optimalPoint: {
      type: Object,
      required: true,
      default: () => ({ x1: 0, x2: 0 })
    },
    constraintLines: {
      type: Array,
      required: true,
      default: () => []
    },
    pizza1Name: {
      type: String,
      default: 'Pizza Muçarela (x1)'
    },
    pizza2Name: {
      type: String,
      default: 'Pizza Calabresa (x2)'
    }
  },
  setup(props) {
    const chartCanvas = ref(null);
    let chartInstance = null;

    const renderChart = () => {
      if (!chartCanvas.value) return;

      // Calculate chart boundaries based on vertices and intercepts
      let maxVal = 50; // default minimum axis scale
      
      // Check vertices to find scale
      props.vertices.forEach(v => {
        maxVal = Math.max(maxVal, v[0], v[1]);
      });

      // Prepare constraint line datasets
      const datasets = [];

      // Determine a maximum value for extending lines (horizontal/vertical)
      const graphLimit = maxVal * 1.25;

      // Color palette for the constraint lines (aesthetic glassmorphic matches)
      const lineColors = {
        farinha: '#6366f1',    // Indigo
        manteiga: '#f59e0b',   // Amber
        queijo: '#ec4899',     // Pink
        molho: '#3b82f6',      // Blue
        calabresa: '#ef4444'   // Red
      };

      const ingredientNamesPt = {
        farinha: 'Farinha',
        manteiga: 'Manteiga',
        queijo: 'Queijo',
        molho: 'Molho',
        calabresa: 'Calabresa'
      };

      // 1. Draw individual constraint lines
      props.constraintLines.forEach(line => {
        const { ingredient, a1, a2, stock } = line;
        const color = lineColors[ingredient] || '#94a3b8';
        const name = ingredientNamesPt[ingredient] || ingredient;
        
        let points = [];
        
        if (a1 > 0 && a2 > 0) {
          // Diagonal line: intersects both axes
          // A1*x1 + A2*x2 = Stock
          points = [
            { x: 0, y: stock / a2 },
            { x: stock / a1, y: 0 }
          ];
        } else if (a1 > 0 && a2 === 0) {
          // Vertical line: A1*x1 = Stock => x1 = Stock / A1
          const xVal = stock / a1;
          points = [
            { x: xVal, y: 0 },
            { x: xVal, y: graphLimit }
          ];
        } else if (a1 === 0 && a2 > 0) {
          // Horizontal line: A2*x2 = Stock => x2 = Stock / A2
          const yVal = stock / a2;
          points = [
            { x: 0, y: yVal },
            { x: graphLimit, y: yVal }
          ];
        }

        if (points.length > 0) {
          datasets.push({
            label: `Limite: ${name}`,
            data: points,
            borderColor: color,
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false,
            showLine: true
          });
          
          // Update maxVal for boundary scaling
          points.forEach(pt => {
            if (pt.x !== graphLimit && pt.y !== graphLimit) {
              maxVal = Math.max(maxVal, pt.x, pt.y);
            }
          });
        }
      });

      const finalLimit = maxVal * 1.15;

      // 2. Draw the feasible region polygon (Shaded Area)
      if (props.vertices.length > 0) {
        // Map vertices for Chart.js dataset [{x, y}, ...]
        // Ensure the origin [0,0] is included and correctly ordered.
        const polygonPoints = props.vertices.map(v => ({ x: v[0], y: v[1] }));
        
        // Add polygon dataset
        datasets.push({
          label: 'Região Viável',
          data: polygonPoints,
          backgroundColor: 'rgba(99, 102, 241, 0.15)', // translucent indigo
          borderColor: 'rgba(99, 102, 241, 0.4)',
          borderWidth: 1.5,
          fill: true,
          pointRadius: 4,
          pointBackgroundColor: 'rgba(255, 255, 255, 0.6)',
          showLine: true,
          tension: 0,
          // Custom property to draw as closed polygon
          closed: true
        });
      }

      // 3. Draw the Optimal Point (highlighted green dot)
      datasets.push({
        label: 'Combinação Ótima',
        data: [{ x: props.optimalPoint.x1, y: props.optimalPoint.x2 }],
        backgroundColor: '#10b981', // Emerald green
        borderColor: '#ffffff',
        borderWidth: 2.5,
        pointRadius: 9,
        pointHoverRadius: 11,
        fill: false
      });

      // Destroy old instance to avoid memory leak and render glitch
      if (chartInstance) {
        chartInstance.destroy();
      }

      const ctx = chartCanvas.value.getContext('2d');
      chartInstance = new Chart(ctx, {
        type: 'scatter',
        data: {
          datasets: datasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            duration: 400
          },
          plugins: {
            legend: {
              position: 'top',
              labels: {
                color: '#94a3b8',
                font: {
                  family: 'Outfit',
                  size: 11
                },
                boxWidth: 15,
                usePointStyle: true
              }
            },
            tooltip: {
              titleFont: { family: 'Outfit', size: 12, weight: 'bold' },
              bodyFont: { family: 'JetBrains Mono', size: 12 },
              callbacks: {
                label: (context) => {
                  const label = context.dataset.label || '';
                  const x = context.parsed.x.toFixed(2);
                  const y = context.parsed.y.toFixed(2);
                  if (label === 'Combinação Ótima') {
                    return `Solução Ideal: ${props.pizza1Name}=${x} ud, ${props.pizza2Name}=${y} ud`;
                  }
                  if (label === 'Região Viável') {
                    return `Vértice: (${x}, ${y})`;
                  }
                  return `${label}: (${x}, ${y})`;
                }
              }
            }
          },
          scales: {
            x: {
              title: {
                display: true,
                text: props.pizza1Name,
                color: '#cbd5e1',
                font: {
                  family: 'Outfit',
                  size: 13,
                  weight: '600'
                }
              },
              grid: {
                color: 'rgba(255, 255, 255, 0.05)',
                borderColor: 'rgba(255, 255, 255, 0.1)'
              },
              ticks: {
                color: '#94a3b8',
                font: {
                  family: 'JetBrains Mono',
                  size: 10
                }
              },
              min: 0,
              max: finalLimit
            },
            y: {
              title: {
                display: true,
                text: props.pizza2Name,
                color: '#cbd5e1',
                font: {
                  family: 'Outfit',
                  size: 13,
                  weight: '600'
                }
              },
              grid: {
                color: 'rgba(255, 255, 255, 0.05)',
                borderColor: 'rgba(255, 255, 255, 0.1)'
              },
              ticks: {
                color: '#94a3b8',
                font: {
                  family: 'JetBrains Mono',
                  size: 10
                }
              },
              min: 0,
              max: finalLimit
            }
          }
        }
      });
    };

    // Watch for updates on inputs to redraw
    watch(
      () => [props.vertices, props.optimalPoint, props.constraintLines],
      () => {
        renderChart();
      },
      { deep: true }
    );

    onMounted(() => {
      renderChart();
    });

    onBeforeUnmount(() => {
      if (chartInstance) {
        chartInstance.destroy();
      }
    });

    return {
      chartCanvas
    };
  }
};
</script>

<style scoped>
.chart-container {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 380px;
  background: rgba(15, 23, 42, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 12px;
  backdrop-filter: blur(10px);
}

@media (max-width: 768px) {
  .chart-container {
    min-height: 280px;
  }
}
</style>

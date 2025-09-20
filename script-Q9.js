// script-Q9.js — renderQ9Charts(opts)
// Yêu cầu: đã nhúng D3 v7 trước file này

(function () {
  function ensureTooltip(selOrId = "#q9-tooltip") {
    // chấp nhận id hoặc selector; nếu chưa có thì tạo
    let el = document.querySelector(selOrId);
    if (!el) {
      const id = selOrId.startsWith("#") ? selOrId.slice(1) : "q9-tooltip";
      el = document.createElement("div");
      el.id = id;
      document.body.appendChild(el);
    }
    return d3.select(el)
      .style("position", "absolute")
      .style("background", "#fff")
      .style("border", "1px solid #e5e7eb")
      .style("padding", "8px 10px")
      .style("border-radius", "8px")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("font-size", "13px")
      .style("box-shadow", "0 6px 18px rgba(0,0,0,.08)")
      .style("z-index", 9999);
  }

  const fmtPct1 = d3.format(".1%");
  const fmtInt  = d3.format(",.0f");

  async function renderQ9Charts(opts) {
    const {
      csvUrl,
      // 6 ô (dùng 5 theo data)
      chartIds = ["#chart1","#chart2","#chart3","#chart4","#chart5"],
      tooltipSel = "#q9-tooltip",
      width = 500,
      height = 300,
      baseMargin = { top: 40, right: 150, bottom: 56, left: 120 },
      // optional: giới hạn top N mặt hàng trên mỗi nhóm (null = không giới hạn)
      topN = null
    } = opts;

    const tooltip = ensureTooltip(tooltipSel);

    // clear cũ
    chartIds.forEach(id => d3.select(id).selectAll("*").remove());

    // ===== Load & rollup =====
    let raw;
    try {
      raw = await d3.csv(csvUrl);
    } catch (e) {
      console.error("Lỗi khi load CSV:", e);
      return;
    }

    // rollup theo Nhóm hàng
    const nested = d3.rollup(
      raw,
      v => {
        const uniqueOrders = new Set(v.map(m => m["Mã đơn hàng"])).size;
        // số đơn duy nhất theo mặt hàng trong nhóm
        const itemCounts = d3.rollup(
          v,
          g => new Set(g.map(m => m["Mã đơn hàng"])).size,
          m => `[${m["Mã mặt hàng"]}] ${m["Tên mặt hàng"]}`
        );
        let items = Array.from(itemCounts, ([MatHang, value]) => ({
          MatHang,
          totalOrders: value,
          probability: uniqueOrders ? value / uniqueOrders : 0
        }));
        // sort desc theo xác suất
        items.sort((a, b) => b.probability - a.probability);
        if (topN && topN > 0) items = items.slice(0, topN);
        return items;
      },
      d => `[${d["Mã nhóm hàng"]}] ${d["Tên nhóm hàng"]}`
    );

    // lấy 5 nhóm đầu (nếu >5)
    const groups = Array.from(nested).slice(0, chartIds.length);

    // vẽ từng chart nhỏ
    groups.forEach(([tenNhomHang, items], idx) => {
      const container = d3.select(chartIds[idx]);
      if (container.empty()) return;

      // tiêu đề nhỏ trên mỗi ô
      container.append("div")
        .attr("class", "q9-chart-title")
        .style("font-weight", "600")
        .style("margin-bottom", "6px")
        .text(tenNhomHang);

      // nới lề trái theo độ dài nhãn
      const longest = d3.max(items, d => d.MatHang.length) || 0;
      const leftMargin = Math.max(baseMargin.left, Math.min(280, 10 + longest * 7));
      const margin = { ...baseMargin, left: leftMargin };

      const innerW = width - margin.left - margin.right;
      const innerH = height - margin.top - margin.bottom;

      const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      const x = d3.scaleLinear()
        .domain([0, d3.max(items, d => d.probability) || 0])
        .nice()
        .range([0, innerW]);

      const y = d3.scaleBand()
        .domain(items.map(d => d.MatHang))
        .range([0, innerH])
        .padding(0.2);

      const color = d3.scaleOrdinal()
        .domain(items.map(d => d.MatHang))
        .range(d3.schemeTableau10);

      // Axes
      svg.append("g")
        .call(d3.axisLeft(y))
        .selectAll("text")
        .style("font-size", longest > 20 ? "10px" : "12px")
        .style("text-anchor", "end");

      svg.append("g")
        .attr("transform", `translate(0,${innerH})`)
        .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format(".0%")).tickSizeOuter(0));

      // Bars
      svg.selectAll(".q9-bar")
        .data(items)
        .enter().append("rect")
          .attr("class", "q9-bar")
          .attr("y", d => y(d.MatHang))
          .attr("x", 0)
          .attr("height", y.bandwidth())
          .attr("width", d => x(d.probability))
          .attr("fill", d => color(d.MatHang))
          .on("mouseover", function (event, d) {
            d3.select(this).style("opacity", 0.75);
            tooltip
              .style("opacity", 1)
              .html(
                `Mặt hàng: <strong>${d.MatHang}</strong><br>
                 Nhóm hàng: ${tenNhomHang}<br>
                 SL đơn (duy nhất): ${fmtInt(d.totalOrders)}<br>
                 Xác suất / nhóm: ${fmtPct1(d.probability)}`
              )
              .style("left", `${event.pageX + 10}px`)
              .style("top",  `${event.pageY - 20}px`);
          })
          .on("mousemove", event => {
            tooltip
              .style("left", `${event.pageX + 10}px`)
              .style("top",  `${event.pageY - 20}px`);
          })
          .on("mouseout", function () {
            d3.select(this).style("opacity", 1);
            tooltip.style("opacity", 0);
          });

      // Value labels
      svg.selectAll(".q9-label")
        .data(items)
        .enter().append("text")
          .attr("class", "q9-label")
          .attr("x", d => x(d.probability) + 6)
          .attr("y", d => y(d.MatHang) + y.bandwidth() / 2)
          .attr("dy", "0.35em")
          .style("font-size", "11px")
          .style("text-anchor", "start")
          .text(d => fmtPct1(d.probability));
    });
  }

  window.renderQ9Charts = renderQ9Charts;
})();

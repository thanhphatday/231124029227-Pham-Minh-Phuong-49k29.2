// script-Q7.js — renderQ7Chart(opts)
// Yêu cầu: đã nhúng D3 v7 trước file này

(function () {
  function ensureTooltip(id = "q7-tooltip") {
    let el = document.getElementById(id);
    if (!el) {
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

  async function renderQ7Chart(opts) {
    const {
      csvUrl,
      container = "#q7-chart",
      tooltipId = "q7-tooltip",
      widthOuter = 1400,
      heightOuter = 520,
      legendWidth = 220,
      labelGap = 50
    } = opts;

    const root = d3.select(container).style("overflow-x", "auto");
    root.selectAll("*").remove();

    const margin = { top: 20, right: 260, bottom: 50, left: 220 };
    const innerW = widthOuter - margin.left - margin.right;
    const innerH = heightOuter - margin.top - margin.bottom;
    const svgOuterWidth = widthOuter + legendWidth + labelGap;

    const svg = root.append("svg")
      .attr("width", svgOuterWidth)
      .attr("height", heightOuter)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const tooltip = ensureTooltip(tooltipId);

    // ===== Load & tính toán dữ liệu (GIỮ NGUYÊN Ý TƯỞNG) =====
    let raw;
    try {
      raw = await d3.csv(csvUrl);
    } catch (e) {
      console.error("Lỗi khi load CSV:", e);
      return;
    }

    // Tổng số đơn duy nhất toàn bộ
    const totalUniqueOrders = new Set(raw.map(d => d["Mã đơn hàng"])).size;

    // rollup: theo Mã nhóm hàng -> Tên nhóm hàng -> { count(unique orders), total rows }
    const nested = d3.rollup(
      raw,
      v => ({
        count: new Set(v.map(d => d["Mã đơn hàng"])).size, // số đơn duy nhất của nhóm
        total: v.length                                     // tổng dòng/đơn ghi (giữ nguyên như code cũ)
      }),
      d => d["Mã nhóm hàng"],
      d => d["Tên nhóm hàng"]
    );

    // Phẳng dữ liệu
    const data = [];
    nested.forEach((tenNhomMap, maNhom) => {
      tenNhomMap.forEach((stats, tenNhomHang) => {
        data.push({
          maNhomHang: maNhom,
          tenNhomHang,
          probability: totalUniqueOrders ? stats.count / totalUniqueOrders : 0,
          totalOrders: stats.total
        });
      });
    });

    // Sắp xếp giảm dần theo xác suất
    data.sort((a, b) => b.probability - a.probability);

    // Nhãn hiển thị
    data.forEach(d => d.label = `[${d.maNhomHang}] ${d.tenNhomHang}`);

    // Màu cố định theo mã nhóm để đồng bộ với Q1–Q2
    const color = d3.scaleOrdinal()
      .domain(["BOT", "THO", "TTC", "TMX", "SET"])
      .range(d3.schemeTableau10);

    // Scales
    const y = d3.scaleBand()
      .domain(data.map(d => d.label))
      .range([0, innerH])
      .padding(0.2);

    const x = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.probability) || 0])
      .nice()
      .range([0, innerW]);

    // Axes
    svg.append("g").call(d3.axisLeft(y));

    svg.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(
        d3.axisBottom(x)
          .ticks(8)
          .tickFormat(d3.format(".0%"))
          .tickSizeOuter(0)
      );

    // Bars
    const bars = svg.selectAll(".q7-bar")
      .data(data)
      .enter().append("rect")
        .attr("class", "q7-bar")
        .attr("y", d => y(d.label))
        .attr("x", 0)
        .attr("height", y.bandwidth())
        .attr("width", d => x(d.probability))
        .attr("fill", d => color(d.maNhomHang))
        .on("mouseover", (event, d) => {
          tooltip
            .style("opacity", 1)
            .html(
              `<strong>${d.label}</strong><br>
               Xác suất bán: ${fmtPct1(d.probability)}<br>
               SL bản ghi/đơn: ${fmtInt(d.totalOrders)}`
            )
            .style("left", `${event.pageX + 10}px`)
            .style("top",  `${event.pageY - 20}px`);
        })
        .on("mousemove", event => {
          tooltip
            .style("left", `${event.pageX + 10}px`)
            .style("top",  `${event.pageY - 20}px`);
        })
        .on("mouseout", () => tooltip.style("opacity", 0));

    // Nhãn giá trị (tránh đè legend)
    const maxLabelX = innerW + labelGap - 8;
    svg.selectAll(".q7-label")
      .data(data)
      .enter().append("text")
        .attr("class", "q7-label")
        .attr("x", d => Math.min(x(d.probability) + 6, maxLabelX))
        .attr("y", d => y(d.label) + y.bandwidth()/2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "start")
        .style("font-size", "12px")
        .text(d => fmtPct1(d.probability));

    // ===== Legend (đồng bộ Q1–Q2) =====
    const legendNames = {
      BOT: "Bột",
      THO: "Trà hoa",
      TTC: "Trà củ, quả sấy",
      TMX: "Trà mix",
      SET: "Set trà"
    };
    const presentCodes = new Set(data.map(d => d.maNhomHang));
    const legendData = color.domain()
      .filter(code => presentCodes.has(code))
      .map(code => ({ code, name: legendNames[code] || code }));

    const legendX = innerW + labelGap;
    const itemH = 24;

    const legend = svg.append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${legendX},0)`);

    const items = legend.selectAll(".legend-item")
      .data(legendData)
      .enter().append("g")
        .attr("class", "legend-item")
        .attr("transform", (_, i) => `translate(0, ${i * itemH})`)
        .style("cursor", "pointer")
        .on("click", (event) => {
          const item = d3.select(event.currentTarget);
          const nowInactive = !item.classed("inactive");
          item.classed("inactive", nowInactive).attr("opacity", nowInactive ? 0.4 : 1);

          const off = legend.selectAll(".legend-item.inactive").data().map(x => x.code);
          bars.transition().duration(200)
              .attr("opacity", d => (off.includes(d.maNhomHang) ? 0.1 : 1));
        });

    items.append("rect")
      .attr("x", 0).attr("y", 4)
      .attr("width", 18).attr("height", 18)
      .attr("rx", 3)
      .attr("fill", d => color(d.code));

    items.append("text")
      .attr("x", 26).attr("y", 16)
      .style("font-size", "13px")
      .text(d => `[${d.code}] ${d.name}`);
  }

  window.renderQ7Chart = renderQ7Chart;
})();

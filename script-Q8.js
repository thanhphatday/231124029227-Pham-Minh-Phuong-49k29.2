// script-Q8.js — renderQ8Chart(opts)
// Yêu cầu: đã nhúng D3 v7 trước file này

(function () {
  function ensureTooltip(id = "q8-tooltip") {
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

  const fmtPct0 = d3.format(".0%");
  const fmtPct1 = d3.format(".1%");

  async function renderQ8Chart(opts) {
    const {
      csvUrl,
      container = "#q8-chart",
      tooltipId = "q8-tooltip",
      widthOuter = 1300,
      heightOuter = 500,
      legendWidth = 260,
      labelGap = 30
    } = opts;

    const root = d3.select(container).style("overflow-x", "auto");
    root.selectAll("*").remove();

    const margin = { top: 50, right: 220, bottom: 50, left: 200 };
    const innerW = widthOuter - margin.left - margin.right;
    const innerH = heightOuter - margin.top - margin.bottom;
    const svgOuterWidth = widthOuter + legendWidth + labelGap;

    const svg = root.append("svg")
      .attr("width", svgOuterWidth)
      .attr("height", heightOuter)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const tooltip = ensureTooltip(tooltipId);

    // ==== Load & chuẩn hoá dữ liệu ====
    let raw;
    try {
      raw = await d3.csv(csvUrl);
    } catch (e) {
      console.error("Lỗi load dữ liệu:", e);
      return;
    }

    const parse1 = d3.timeParse("%Y-%m-%d %H:%M:%S");
    const parse2 = d3.timeParse("%Y-%m-%d"); // fallback nếu không có giờ

    raw.forEach(d => {
      const s = String(d["Mã đơn hàng"] || "").trim();
      d["Mã đơn hàng"] = s;
      let t = parse1(d["Thời gian tạo đơn"]);
      if (!t) t = parse2(d["Thời gian tạo đơn"]);
      d.__date = t || new Date(NaN);
      d.__month = isNaN(d.__date) ? null : (d.__date.getMonth() + 1);
      d.__group = `[${d["Mã nhóm hàng"]}] ${d["Tên nhóm hàng"]}`;
    });

    // Bỏ các dòng không parse được tháng
    const rows = raw.filter(r => r.__month != null);

    // Số đơn duy nhất theo tháng (mẫu số)
    const totalDistinctOrdersByMonth = d3.rollups(
      rows,
      v => new Set(v.map(x => x["Mã đơn hàng"])).size,
      d => d.__month
    );
    const totalByMonthMap = new Map(totalDistinctOrdersByMonth); // month -> total distinct orders

    // Số đơn duy nhất theo (tháng, nhóm)
    const groupByMonthGroup = d3.rollups(
      rows,
      v => new Set(v.map(x => x["Mã đơn hàng"])).size,
      d => d.__month,
      d => d.__group
    );

    // Chuẩn hoá thành mảng data { month, group, probability }
    const data = [];
    for (const [month, groups] of groupByMonthGroup) {
      const totalInMonth = totalByMonthMap.get(month) || 0;
      for (const [groupName, groupDistinct] of groups) {
        const p = totalInMonth > 0 ? groupDistinct / totalInMonth : 0;
        data.push({ month: +month, group: groupName, probability: p });
      }
    }

    // Gom theo nhóm để vẽ đường
    const series = d3.groups(data, d => d.group)
      .map(([key, values]) => {
        // đảm bảo đủ tháng 1..12 (nếu thiếu)
        const byMonth = new Map(values.map(v => [v.month, v]));
        const full = d3.range(1, 13).map(m => byMonth.get(m) || { month: m, group: key, probability: 0 });
        // sắp theo tháng tăng dần
        full.sort((a, b) => a.month - b.month);
        return [key, full];
      });

    // ==== Scales ====
    const x = d3.scaleLinear()
      .domain([1, 12])
      .range([0, innerW]);

    const y = d3.scaleLinear()
      .domain([0, 1]).nice()
      .range([innerH, 0]);

    // Màu: dựa trên mã nhóm trong group string nếu có
    const codeFromGroup = g => {
      const m = /^\[(.*?)\]/.exec(g);
      return m ? m[1] : g;
    };
    const color = d3.scaleOrdinal()
      .domain(["BOT", "THO", "TTC", "TMX", "SET"]) // domain cố định nếu có
      .range(d3.schemeTableau10);
    // Nếu có nhóm ngoài domain, vẫn gán màu từ scheme
    const unknownGroups = series.map(s => codeFromGroup(s[0])).filter(c => !color.domain().includes(c));
    if (unknownGroups.length) {
      const all = color.domain().concat(unknownGroups);
      color.domain(all);
    }

    // ==== Axes ====
    svg.append("g")
      .attr("transform", `translate(0, ${innerH})`)
      .call(d3.axisBottom(x).ticks(12).tickFormat(d => `Tháng ${d}`).tickSizeOuter(0))
      .selectAll("text")
      .style("font-size", "12px");

    svg.append("g")
      .call(d3.axisLeft(y).ticks(8).tickFormat(d3.format(".0%")).tickSizeOuter(0))
      .selectAll("text")
      .style("font-size", "12px");

    // ==== Lines ====
    const line = d3.line()
      .x(d => x(d.month))
      .y(d => y(d.probability))
      .defined(d => d.month >= 1 && d.month <= 12); // phòng dữ liệu bẩn

    const lines = svg.selectAll(".q8-line")
      .data(series, d => d[0])
      .enter().append("path")
        .attr("class", "q8-line")
        .attr("fill", "none")
        .attr("stroke-width", 2)
        .attr("stroke", d => color(codeFromGroup(d[0])))
        .attr("d", d => line(d[1]));

    // ==== Dots + Tooltip (hiển thị tất cả nhóm trong tháng đang hover) ====
    const allPoints = series.flatMap(s => s[1]);
    const byMonth = d3.group(allPoints, d => d.month);

    svg.selectAll(".q8-dot")
      .data(allPoints)
      .enter().append("circle")
        .attr("class", "q8-dot")
        .attr("r", 3.5)
        .attr("cx", d => x(d.month))
        .attr("cy", d => y(d.probability))
        .attr("fill", d => color(codeFromGroup(d.group)))
        .on("mouseover", (event, d) => {
          const arr = (byMonth.get(d.month) || []).slice().sort((a, b) => b.probability - a.probability);
          let html = `<strong>Tháng ${String(d.month).padStart(2,"0")}</strong><br/>`;
          arr.forEach(e => {
            html += `
              <div style="display:flex;align-items:center;gap:6px">
                <div style="width:10px;height:10px;border-radius:50%;background:${color(codeFromGroup(e.group))}"></div>
                <span>${e.group}: ${fmtPct0(e.probability)}</span>
              </div>`;
          });
          tooltip.style("opacity", 1)
            .html(html)
            .style("left", `${event.pageX + 10}px`)
            .style("top",  `${event.pageY - 20}px`);
        })
        .on("mousemove", (event) => {
          tooltip
            .style("left", `${event.pageX + 10}px`)
            .style("top",  `${event.pageY - 20}px`);
        })
        .on("mouseout", () => tooltip.style("opacity", 0));

    // ==== Legend (click ẩn/hiện) ====
    const legendData = series.map(s => {
      const code = codeFromGroup(s[0]);
      return { key: s[0], code, label: s[0] };
    });

    const legendX = innerW + labelGap;
    const itemH = 22;

    const legend = svg.append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${legendX},0)`);

    const items = legend.selectAll(".legend-item")
      .data(legendData)
      .enter().append("g")
        .attr("class", "legend-item")
        .attr("transform", (_, i) => `translate(0, ${i * itemH})`)
        .style("cursor", "pointer")
        .on("click", function (event, d) {
          const g = d3.select(this);
          const nowInactive = !g.classed("inactive");
          g.classed("inactive", nowInactive).attr("opacity", nowInactive ? 0.4 : 1);

          // toggle visibility
          const offKeys = new Set(legend.selectAll(".legend-item.inactive").data().map(x => x.key));
          lines.attr("opacity", s => offKeys.has(s[0]) ? 0.1 : 1);
          svg.selectAll(".q8-dot")
            .attr("opacity", p => offKeys.has(p.group) ? 0.1 : 1);
        });

    items.append("rect")
      .attr("x", 0).attr("y", 4)
      .attr("width", 18).attr("height", 18)
      .attr("rx", 3)
      .attr("fill", d => color(d.code));

    items.append("text")
      .attr("x", 26).attr("y", 16)
      .style("font-size", "13px")
      .text(d => d.label);
  }

  window.renderQ8Chart = renderQ8Chart;
})();

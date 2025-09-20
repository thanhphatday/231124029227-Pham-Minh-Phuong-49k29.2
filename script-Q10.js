// script-Q10.js — renderQ10Charts(opts)
// Yêu cầu: đã nhúng D3 v7 trước file này

(function () {
  function ensureTooltip(id = "q10-tooltip") {
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
  const fmt0 = d3.format("02");

  async function renderQ10Charts(opts) {
    const {
      csvUrl,
      container = "#q10-charts",   // nơi chứa các mini charts
      tooltipId = "q10-tooltip",
      // kích thước mỗi mini chart (svg)
      width = 450, height = 300,
      margin = { top: 50, right: 50, bottom: 50, left: 60 },
    } = opts;

    const root = d3.select(container);
    root.selectAll("*").remove();

    const tooltip = ensureTooltip(tooltipId);

    // ==== Load & chuẩn hoá dữ liệu ====
    let raw;
    try {
      raw = await d3.csv(csvUrl);
    } catch (e) {
      console.error("Lỗi load CSV:", e);
      return;
    }

    const parse1 = d3.timeParse("%Y-%m-%d %H:%M:%S");
    const parse2 = d3.timeParse("%Y-%m-%d");

    raw.forEach(d => {
      let t = parse1(d["Thời gian tạo đơn"]);
      if (!t) t = parse2(d["Thời gian tạo đơn"]);
      d.__date = t || new Date(NaN);
      d.__month = isNaN(d.__date) ? null : (d.__date.getMonth() + 1);

      d["Mã đơn hàng"] = String(d["Mã đơn hàng"] || "").trim();
      d.__group = `[${d["Mã nhóm hàng"]}] ${d["Tên nhóm hàng"]}`;
      d.__item  = `[${d["Mã mặt hàng"]}] ${d["Tên mặt hàng"]}`;
    });

    const rows = raw.filter(d => d.__month != null);

    // Tổng đơn duy nhất theo (tháng, nhóm)
    const groupByMonthGroup = d3.rollups(
      rows,
      v => new Set(v.map(d => d["Mã đơn hàng"])).size,
      d => d.__month,
      d => d.__group
    );
    const totalOrdersByGroupMonth = new Map(
      groupByMonthGroup.flatMap(([m, arr]) => arr.map(([g, c]) => [`${m}@@${g}`, c]))
    );

    // Đơn duy nhất theo (tháng, nhóm, mặt hàng)
    const groupByMonthGroupItem = d3.rollups(
      rows,
      v => ({ count: new Set(v.map(d => d["Mã đơn hàng"])).size }),
      d => d.__month,
      d => d.__group,
      d => d.__item
    );

    // Chuẩn data phẳng: {month, group, item, probability}
    const flat = [];
    for (const [month, groups] of groupByMonthGroupItem) {
      for (const [groupName, items] of groups) {
        const denom = totalOrdersByGroupMonth.get(`${month}@@${groupName}`) || 0;
        for (const [itemName, { count }] of items) {
          flat.push({
            month: +month,
            group: groupName,
            item: itemName,
            count,
            probability: denom > 0 ? count / denom : 0
          });
        }
      }
    }

    // Gom theo group để vẽ mỗi mini chart
    const dataByGroup = d3.groups(flat, d => d.group);

    dataByGroup.forEach(([groupName, groupData]) => {
      // Container cho mỗi chart
      const card = root.append("div")
        .attr("class", "q10-card")
        .style("background", "#fff")
        .style("border", "1px solid #e5e7eb")
        .style("border-radius", "12px")
        .style("padding", "10px 12px")
        .style("box-shadow", "0 6px 18px rgba(0,0,0,.04)");

      card.append("div")
        .attr("class", "q10-chart-title")
        .style("font-weight", "600")
        .style("margin-bottom", "6px")
        .text(groupName);

      const innerW = width - margin.left - margin.right;
      const innerH = height - margin.top - margin.bottom;

      const svg = card.append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      // Tập item của group & gom series theo item
      const series = d3.groups(groupData, d => d.item)
        .map(([key, vals]) => {
          const byMonth = new Map(vals.map(v => [v.month, v]));
          const full = d3.range(1, 13).map(m => byMonth.get(m) || { month: m, group: groupName, item: key, probability: 0 });
          full.sort((a, b) => a.month - b.month);
          return [key, full];
        });

      // Scales
      const x = d3.scaleLinear().domain([1, 12]).range([0, innerW]);
      const y = d3.scaleLinear()
        .domain([
          Math.max(0, d3.min(groupData, d => d.probability) - 0.1),
          Math.min(1, d3.max(groupData, d => d.probability) + 0.1)
        ])
        .nice()
        .range([innerH, 0]);

      const color = d3.scaleOrdinal()
        .domain(series.map(s => s[0]))
        .range(d3.schemeTableau10);

      // Axes
      svg.append("g")
        .attr("transform", `translate(0, ${innerH})`)
        .call(d3.axisBottom(x).ticks(12).tickFormat(d => `T${fmt0(d)}`).tickSizeOuter(0))
        .selectAll("text").style("font-size", "11px");

      svg.append("g")
        .call(d3.axisLeft(y).tickFormat(d3.format(".0%")).tickSizeOuter(0))
        .selectAll("text").style("font-size", "12px");

      // Lines
      const line = d3.line()
        .x(d => x(d.month))
        .y(d => y(d.probability));

      svg.selectAll(".q10-line")
        .data(series, d => d[0])
        .enter().append("path")
          .attr("class", "q10-line")
          .attr("fill", "none")
          .attr("stroke-width", 2)
          .attr("stroke", s => color(s[0]))
          .attr("d", s => line(s[1]));

      // Dots + Tooltip (hiển thị all items của group trong tháng hover)
      const allPoints = series.flatMap(s => s[1]);
      const byMonth = d3.group(allPoints, d => d.month);

      svg.selectAll(".q10-dot")
        .data(allPoints)
        .enter().append("circle")
          .attr("class", "q10-dot")
          .attr("r", 4)
          .attr("cx", d => x(d.month))
          .attr("cy", d => y(d.probability))
          .attr("fill", d => color(d.item))
          .on("mouseover", (event, d) => {
            const list = (byMonth.get(d.month) || [])
              .filter(x => x.group === groupName)
              .slice().sort((a, b) => a.item.localeCompare(b.item));

            let html = `<strong>${groupName} — T${fmt0(d.month)}</strong><br/>`;
            list.forEach(e => {
              // tách mã [SETxx] (nếu bạn muốn ưu tiên SET có thể điều chỉnh regex)
              const m = e.item.match(/\[[A-Z]+\d+\]/);
              const code = m ? m[0] : "";
              const name = e.item.replace(code, "").trim();
              html += `${code} ${name}: <strong>${fmtPct1(e.probability)}</strong><br/>`;
            });

            tooltip.style("opacity", 1)
              .html(html)
              .style("left", `${event.pageX + 10}px`)
              .style("top",  `${event.pageY - 20}px`)
              .style("white-space", "nowrap");
          })
          .on("mousemove", (event) => {
            tooltip.style("left", `${event.pageX + 10}px`).style("top", `${event.pageY - 20}px`);
          })
          .on("mouseout", () => tooltip.style("opacity", 0));
    });
  }

  window.renderQ10Charts = renderQ10Charts;
})();

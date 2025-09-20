// script-Q2.js — renderQ2Chart(opts)
// Yêu cầu: <script src="https://cdn.jsdelivr.net/npm/d3@7"></script> đã được nhúng trước

(function () {
  function ensureTooltip(id = "q2-tooltip") {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement("div");
      el.id = id;
      document.body.appendChild(el);
    }
    return d3.select(el)
      .style("position", "absolute")
      .style("background", "#fff")
      .style("border", "1px solid #ccc")
      .style("padding", "8px")
      .style("border-radius", "6px")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("font-size", "13px")
      .style("box-shadow", "0 4px 10px rgba(0,0,0,.08)")
      .style("z-index", 9999);
  }

  function million(v) { return d3.format(",.0f")(v / 1e6) + " triệu"; }

  async function renderQ2Chart(opts) {
    const {
      csvUrl,
      container = "#q2-chart",
      tooltipId = "q2-tooltip",
      widthOuter = 1200,
      heightOuter = 600,
      legendWidth = 220,
      labelGap = 50
    } = opts;

    const root = d3.select(container).style("overflow-x", "auto");
    root.selectAll("*").remove();

    const margin = { top: 20, right: 260, bottom: 50, left: 200 };
    const innerW = widthOuter - margin.left - margin.right;
    const innerH = heightOuter - margin.top - margin.bottom;

    const svgOuterWidth = widthOuter + legendWidth + labelGap;

    const svg = root.append("svg")
      .attr("width", svgOuterWidth)
      .attr("height", heightOuter)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const tooltip = ensureTooltip(tooltipId);

    // Load CSV
    let raw;
    try {
      raw = await d3.csv(csvUrl);
    } catch (e) {
      console.error("Lỗi khi load CSV:", e);
      return;
    }

    // Chuẩn hoá
    raw.forEach(d => {
      d["Thành tiền"] = +d["Thành tiền"];
      d["SL"] = +d["SL"];
    });

    // Gộp theo Tên nhóm hàng
    const rolled = d3.rollup(
      raw,
      v => ({
        doanhThu: d3.sum(v, x => x["Thành tiền"]),
        soLuong: d3.sum(v, x => x["SL"]),
        maNhomHang: v[0]["Mã nhóm hàng"],
        tenNhomHang: v[0]["Tên nhóm hàng"]
      }),
      d => d["Tên nhóm hàng"]
    );

    const data = Array.from(rolled, ([tenNhomHang, vals]) => ({ tenNhomHang, ...vals }))
      .sort((a, b) => b.doanhThu - a.doanhThu);

    // Màu cố định
    const color = d3.scaleOrdinal()
      .domain(["BOT", "THO", "TTC", "TMX", "SET"])
      .range(d3.schemeTableau10);

    // Scales
    const y = d3.scaleBand()
      .domain(data.map(d => `[${d.maNhomHang}] ${d.tenNhomHang}`))
      .range([0, innerH])
      .padding(0.2);

    const x = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.doanhThu) || 0]).nice()
      .range([0, innerW]);

    // Axes
    svg.append("g").call(d3.axisLeft(y));
    const formatAxis = d3.format(".1f"); // 1 chữ số thập phân
    svg.append("g")
      .attr("transform", `translate(0, ${innerH})`)
      .call(
        d3.axisBottom(x)
          .ticks(10) // giảm số tick để đỡ dày
          .tickFormat(v => {
            if (v >= 1e9) {
              return formatAxis(v / 1e9) + " tỷ";
            } else {
              return d3.format(",.0f")(v / 1e6) + " triệu";
            }
          })
          .tickSizeOuter(0)
      );

    // Bars
    const bars = svg.selectAll(".q2-bar")
      .data(data)
      .enter().append("rect")
        .attr("class", "q2-bar")
        .attr("y", d => y(`[${d.maNhomHang}] ${d.tenNhomHang}`))
        .attr("x", 0)
        .attr("height", y.bandwidth())
        .attr("width", d => x(d.doanhThu))
        .attr("fill", d => color(d.maNhomHang))
        .on("mouseover", (event, d) => {
          tooltip
            .style("opacity", 1)
            .html(
              `Nhóm hàng: <strong>[${d.maNhomHang}] ${d.tenNhomHang}</strong><br>
               Doanh số bán: ${million(d.doanhThu)} VND<br>
               Số lượng bán: ${d3.format(",")(d.soLuong)} SKUs`
            )
            .style("left", `${event.pageX + 10}px`)
            .style("top", `${event.pageY - 20}px`);
        })
        .on("mousemove", event => {
          tooltip
            .style("left", `${event.pageX + 10}px`)
            .style("top", `${event.pageY - 20}px`);
        })
        .on("mouseout", () => tooltip.style("opacity", 0));

    // Labels (tránh đè legend)
    const maxLabelX = innerW + labelGap - 8;
    svg.selectAll(".q2-label")
      .data(data)
      .enter().append("text")
        .attr("class", "q2-label")
        .attr("x", d => Math.min(x(d.doanhThu) + 5, maxLabelX))
        .attr("y", d => y(`[${d.maNhomHang}] ${d.tenNhomHang}`) + y.bandwidth() / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "start")
        .style("font-size", "12px")
        .text(d => d3.format(",.0f")(d.doanhThu / 1e6) + " triệu VND");

    // Legend
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

  // Expose
  window.renderQ2Chart = renderQ2Chart;
})();

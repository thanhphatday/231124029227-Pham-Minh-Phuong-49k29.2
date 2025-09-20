// script-Q3.js — renderQ3Chart(opts)
// Yêu cầu: <script src="https://cdn.jsdelivr.net/npm/d3@7"></script> đã được nhúng trước

(function () {
  function ensureTooltip(id = "q3-tooltip") {
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

  const fmtInt = d3.format(",.0f");
  const fmt1 = d3.format(".1f");
  function fmtTriệuTỷ(v) {
    return (v >= 1e9) ? `${fmt1(v/1e9)} tỷ` : `${fmtInt(v/1e6)} triệu`;
  }
  function fmtTriệuTỷVND(v) {
    return (v >= 1e9) ? `${fmt1(v/1e9)} tỷ VND` : `${fmtInt(v/1e6)} triệu VND`;
  }

  async function renderQ3Chart(opts) {
    const {
      csvUrl,
      container = "#q3-chart",
      tooltipId = "q3-tooltip",
      widthOuter = 1300,
      heightOuter = 600
    } = opts;

    const root = d3.select(container).style("overflow-x", "auto");
    root.selectAll("*").remove();

    const margin = { top: 20, right: 20, bottom: 60, left: 120 };
    const width  = widthOuter - margin.left - margin.right;
    const height = heightOuter - margin.top - margin.bottom;

    const svg = root.append("svg")
      .attr("width", widthOuter)
      .attr("height", heightOuter)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const tooltip = ensureTooltip(tooltipId);

    // ==== Load & chuẩn hoá dữ liệu ====
    let rawData;
    try {
      rawData = await d3.csv(csvUrl);
    } catch (e) {
      console.error("Lỗi khi load CSV:", e);
      return;
    }

    rawData.forEach(d => {
      d["Thành tiền"] = +d["Thành tiền"];
      d["SL"] = +d["SL"];
      // Giữ nguyên nội dung: tạo trường "Tháng" từ "Thời gian tạo đơn"
      // Giả định format YYYY-MM-DD hoặc tương tự, lấy phần tháng ở giữa
      const parts = String(d["Thời gian tạo đơn"] || "").split("-");
      const mm = parts[1] ? parts[1].padStart(2, "0") : "01";
      d.Tháng = `Tháng ${mm}`;
    });

    const rolled = d3.rollup(
      rawData,
      v => ({
        doanhThu: d3.sum(v, x => x["Thành tiền"]),
        soLuong:  d3.sum(v, x => x["SL"])
      }),
      d => d.Tháng
    );

    // Giữ nội dung: mảng { Tháng, doanhThu, soLuong }, sort theo thứ tự số tháng
    const data = Array.from(rolled, ([Tháng, { doanhThu, soLuong }]) => ({ Tháng, doanhThu, soLuong }))
      .sort((a, b) => a.Tháng.localeCompare(b.Tháng, "vi", { numeric: true }));

    // ==== Scales ====
    const x = d3.scaleBand()
      .domain(data.map(d => d.Tháng))
      .range([0, width])
      .padding(0.2);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.doanhThu) || 0])
      .nice()
      .range([height, 0]);

    // Màu: giữ như cũ — màu theo tháng
    const color = d3.scaleOrdinal(d3.schemeTableau10).domain(x.domain());

    // ==== Axes (đẹp như Q1/Q2, formatter triệu/tỷ) ====
    svg.append("g")
      .attr("transform", `translate(0, ${height})`)
      .call(
        d3.axisBottom(x)
          .tickSizeOuter(0)
      )
      .selectAll("text")
      .style("font-size", "12px");

    svg.append("g")
      .call(
        d3.axisLeft(y)
          .ticks(8)
          .tickFormat(v => fmtTriệuTỷ(v))
          .tickSizeOuter(0)
      )
      .selectAll("text")
      .style("font-size", "12px");

    // ==== Bars ====
    const bars = svg.selectAll(".q3-bar")
      .data(data)
      .enter().append("rect")
        .attr("class", "q3-bar")
        .attr("x", d => x(d.Tháng))
        .attr("y", d => y(d.doanhThu))
        .attr("width", x.bandwidth())
        .attr("height", d => height - y(d.doanhThu))
        .attr("fill", d => color(d.Tháng))
        .on("mouseover", (event, d) => {
          tooltip
            .style("opacity", 1)
            .html(
              `<strong>${d.Tháng}</strong><br>
               Doanh số: ${fmtTriệuTỷVND(d.doanhThu)}<br>
               Số lượng: ${fmtInt(d.soLuong)} SKUs`
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

    // ==== Nhãn trên đầu cột (theo triệu/tỷ) ====
    svg.selectAll(".q3-label")
      .data(data)
      .enter().append("text")
        .attr("class", "q3-label")
        .attr("x", d => x(d.Tháng) + x.bandwidth() / 2)
        .attr("y", d => y(d.doanhThu) - 6)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .text(d => fmtTriệuTỷVND(d.doanhThu));
  }

  // Expose
  window.renderQ3Chart = renderQ3Chart;
})();

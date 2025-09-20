// script-Q6.js — renderQ6Chart(opts)
// Yêu cầu: đã nhúng D3 v7 trước file này

(function () {
  function ensureTooltip(id = "q6-tooltip") {
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
  const fmtTriệuTỷ    = v => v >= 1e9 ? `${fmt1(v/1e9)} tỷ`      : `${fmtInt(v/1e6)} triệu`;
  const fmtTriệuTỷVND = v => v >= 1e9 ? `${fmt1(v/1e9)} tỷ VND` : `${fmtInt(v/1e6)} triệu VND`;

  async function renderQ6Chart(opts) {
    const {
      csvUrl,
      container = "#q6-chart",
      tooltipId = "q6-tooltip",
      widthOuter = 1500,
      heightOuter = 600
    } = opts;

    const root = d3.select(container).style("overflow-x", "auto");
    root.selectAll("*").remove();

    const margin = { top: 20, right: 20, bottom: 80, left: 120 };
    const width  = widthOuter - margin.left - margin.right;
    const height = heightOuter - margin.top - margin.bottom;

    const svg = root.append("svg")
      .attr("width", widthOuter)
      .attr("height", heightOuter)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const tooltip = ensureTooltip(tooltipId);

    // ==== Load & chuẩn hoá dữ liệu ====
    let raw;
    try {
      raw = await d3.csv(csvUrl);
    } catch (e) {
      console.error("Lỗi khi load CSV:", e);
      return;
    }

    raw.forEach(d => {
      d["Thành tiền"] = +d["Thành tiền"];
      d["SL"] = +(d["SL"] ?? d["Số lượng"] ?? 0);
      const t = new Date(d["Thời gian tạo đơn"]);
      if (!isNaN(t)) {
        d.__hour   = t.getHours();
        d.__dayKey = t.toISOString().split("T")[0]; // yyyy-mm-dd
      } else {
        d.__hour = undefined;
        d.__dayKey = undefined;
      }
    });

    // Giữ khung giờ 08:00–23:59
    const timeSlots = Array.from({ length: 24 }, (_, i) =>
      `${String(i).padStart(2,"0")}:00-${String(i).padStart(2,"0")}:59`
    );
    const filtered = raw.filter(d => d.__hour >= 8 && d.__hour <= 23);

    // Gộp theo giờ, tính TB theo số ngày có đơn
    const grouped = d3.group(filtered, d => d.__hour);
    const data = [];
    grouped.forEach((rows, hour) => {
      const dayCount = new Set(rows.map(r => r.__dayKey)).size;
      const sumRev = d3.sum(rows, r => r["Thành tiền"]);
      const sumQty = d3.sum(rows, r => r["SL"]);
      const doanhThuTB = dayCount ? sumRev / dayCount : 0;
      const soLuongTB  = dayCount ? sumQty / dayCount : 0;
      data.push({
        Giờ: hour,
        KhungGiờ: timeSlots[hour],
        doanhThuTB,
        soLuongTB
      });
    });

    // Sắp theo 08..23
    data.sort((a, b) => a.Giờ - b.Giờ);

    // ==== Scales ====
    const x = d3.scaleBand()
      .domain(timeSlots.slice(8, 24))
      .range([0, width])
      .padding(0.2);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.doanhThuTB) || 0])
      .nice()
      .range([height, 0]);

    const color = d3.scaleOrdinal()
      .domain(d3.range(8, 24)) // 8..23
      .range(d3.schemeTableau10);

    // ==== Axes ====
    svg.append("g")
      .attr("transform", `translate(0, ${height})`)
      .call(d3.axisBottom(x).tickSizeOuter(0))
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end")
      .style("font-size", "11px");

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
    svg.selectAll(".q6-bar")
      .data(data)
      .enter().append("rect")
        .attr("class", "q6-bar")
        .attr("x", d => x(d.KhungGiờ))
        .attr("y", d => y(d.doanhThuTB))
        .attr("width", x.bandwidth())
        .attr("height", d => height - y(d.doanhThuTB))
        .attr("fill", d => color(d.Giờ))
        .on("mouseover", (event, d) => {
          tooltip
            .style("opacity", 1)
            .html(
              `Khung giờ: <strong>${d.KhungGiờ}</strong><br>
               Doanh thu TB: ${fmtTriệuTỷVND(d.doanhThuTB)}<br>
               Số lượng TB: ${fmtInt(d.soLuongTB)} SKUs`
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

    // ==== Labels ====
    svg.selectAll(".q6-label")
      .data(data)
      .enter().append("text")
        .attr("class", "q6-label")
        .attr("x", d => x(d.KhungGiờ) + x.bandwidth()/2)
        .attr("y", d => y(d.doanhThuTB) - 6)
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .text(d => fmtTriệuTỷ(d.doanhThuTB));
  }

  window.renderQ6Chart = renderQ6Chart;
})();

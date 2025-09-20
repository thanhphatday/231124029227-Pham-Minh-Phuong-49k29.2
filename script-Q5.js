// script-Q5.js — renderQ5Chart(opts)

(function () {
  function ensureTooltip(id = "q5-tooltip") {
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
  const fmtTriệuTỷ = v => v >= 1e9 ? `${fmt1(v/1e9)} tỷ` : `${fmtInt(v/1e6)} triệu`;
  const fmtTriệuTỷVND = v => v >= 1e9 ? `${fmt1(v/1e9)} tỷ VND` : `${fmtInt(v/1e6)} triệu VND`;

  async function renderQ5Chart(opts) {
    const {
      csvUrl,
      container = "#q5-chart",
      tooltipId = "q5-tooltip",
      widthOuter = 1400,
      heightOuter = 600
    } = opts;

    const root = d3.select(container).style("overflow-x", "auto");
    root.selectAll("*").remove();

    const margin = { top: 30, right: 20, bottom: 70, left: 120 };
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
      d["SL"] = +d["SL"];
      const dt = new Date(d["Thời gian tạo đơn"]);
      d.__day = dt.getDate();
      d.__month = dt.getMonth() + 1;
      d.__dayKey = `${d.__day}-${d.__month}`;
    });

    const nested = d3.rollups(
      raw,
      v => {
        const doanhThuTong = d3.sum(v, r => r["Thành tiền"]);
        const slTong = d3.sum(v, r => r["SL"]);
        const soNgay = new Set(v.map(r => r.__dayKey)).size;
        return {
          doanhThuTB: soNgay > 0 ? doanhThuTong / soNgay : 0,
          slTB:       soNgay > 0 ? slTong / soNgay : 0,
          tongDoanhThu: doanhThuTong,
          tongSL: slTong,
          soNgay
        };
      },
      d => d.__day
    );

    const data = nested.map(([ngay, v]) => ({
      ngay,
      ...v
    })).sort((a, b) => a.ngay - b.ngay);

    // ==== Scales ====
    const x = d3.scaleBand()
      .domain(data.map(d => d.ngay))
      .range([0, width])
      .padding(0.2);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.doanhThuTB) || 0])
      .nice()
      .range([height, 0]);

    const color = d3.scaleOrdinal()
      .domain(data.map(d => d.ngay))
      .range(d3.schemePaired);

    // ==== Axes ====
    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(
        d3.axisBottom(x)
          .tickFormat(d => `Ngày ${String(d).padStart(2, "0")}`)
          .tickSizeOuter(0)
      )
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
    svg.selectAll(".q5-bar")
      .data(data)
      .enter().append("rect")
        .attr("class", "q5-bar")
        .attr("x", d => x(d.ngay))
        .attr("y", d => y(d.doanhThuTB))
        .attr("width", x.bandwidth())
        .attr("height", d => height - y(d.doanhThuTB))
        .attr("fill", d => color(d.ngay))
        .on("mouseover", (event, d) => {
          tooltip
            .style("opacity", 1)
            .html(
              `<strong>Ngày ${d.ngay}</strong><br>
               Doanh thu TB: ${fmtTriệuTỷVND(d.doanhThuTB)}<br>
               Số lượng TB: ${fmtInt(d.slTB)} SKUs`
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
    svg.selectAll(".q5-label")
      .data(data)
      .enter().append("text")
        .attr("class", "q5-label")
        .attr("x", d => x(d.ngay) + x.bandwidth()/2)
        .attr("y", d => y(d.doanhThuTB) - 6)
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .text(d => fmtTriệuTỷ(d.doanhThuTB));
  }

  window.renderQ5Chart = renderQ5Chart;
})();

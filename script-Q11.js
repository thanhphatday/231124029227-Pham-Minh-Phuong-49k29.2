// script-Q11.js — Phân phối lượt mua hàng theo số KH
// Yêu cầu: đã nhúng D3 v7 trước file này

(function () {
  function ensureTooltip(id = "q11-tooltip") {
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

  async function renderQ11(opts) {
    const {
      csvUrl,
      container = "#chart",
      tooltipId = "q11-tooltip",
      widthOuter = 1200,
      heightOuter = 600,
      margin = { top: 20, right: 20, bottom: 60, left: 80 },
      barColor = "#2563eb"
    } = opts;

    const root = d3.select(container);
    root.selectAll("*").remove();

    const innerW = widthOuter - margin.left - margin.right;
    const innerH = heightOuter - margin.top - margin.bottom;

    const svg = root.append("svg")
      .attr("width", widthOuter)
      .attr("height", heightOuter)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const tooltip = ensureTooltip(tooltipId);

    // ===== Load & chuẩn hoá =====
    let raw;
    try {
      raw = await d3.csv(csvUrl);
    } catch (e) {
      console.error("Lỗi load dữ liệu:", e);
      return;
    }

    // Số đơn duy nhất / KH
    const purchasesByCustomer = d3.rollups(
      raw,
      v => new Set(v.map(d => d["Mã đơn hàng"])).size,
      d => d["Mã khách hàng"]
    );

    // Phân phối: (số lần mua) -> (số KH có đúng số lần đó)
    const distribution = d3.rollups(
      purchasesByCustomer,
      v => v.length,
      d => d[1]
    );

    const data = distribution
      .map(([purchaseCount, customerCount]) => ({
        purchaseCount: +purchaseCount,
        customerCount: +customerCount
      }))
      .sort((a, b) => a.purchaseCount - b.purchaseCount);

    // ===== Scales =====
    const x = d3.scaleBand()
      .domain(data.map(d => d.purchaseCount))
      .range([0, innerW])
      .padding(0.2);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.customerCount) || 0])
      .nice()
      .range([innerH, 0]);

    // ===== Axes =====
    svg.append("g")
      .attr("transform", `translate(0, ${innerH})`)
      .call(
        d3.axisBottom(x)
          .tickFormat(d => `${d} lần`)
          .tickSizeOuter(0)
      )
      .selectAll("text")
      .style("font-size", "12px");

    svg.append("g")
      .call(d3.axisLeft(y).ticks(8).tickFormat(v => fmtInt(v)).tickSizeOuter(0))
      .selectAll("text")
      .style("font-size", "12px");

    // Grid ngang nhẹ cho dễ đọc
    svg.append("g")
      .attr("class", "y-grid")
      .call(
        d3.axisLeft(y)
          .tickSize(-innerW)
          .tickFormat(() => "")
      )
      .selectAll("line")
      .attr("stroke", "#e5e7eb")
      .attr("stroke-opacity", 0.6);

    // ===== Bars =====
    svg.selectAll(".q11-bar")
      .data(data)
      .enter().append("rect")
        .attr("class", "q11-bar")
        .attr("x", d => x(d.purchaseCount))
        .attr("y", d => y(d.customerCount))
        .attr("width", x.bandwidth())
        .attr("height", d => innerH - y(d.customerCount))
        .attr("fill", barColor)
        .on("mouseover", (event, d) => {
          tooltip
            .style("opacity", 1)
            .html(
              `<strong>${d.purchaseCount} lần mua</strong><br/>
               Số khách hàng: ${fmtInt(d.customerCount)}`
            )
            .style("left", `${event.pageX + 10}px`)
            .style("top",  `${event.pageY - 28}px`);
        })
        .on("mousemove", (event) => {
          tooltip
            .style("left", `${event.pageX + 10}px`)
            .style("top",  `${event.pageY - 28}px`);
        })
        .on("mouseout", () => tooltip.style("opacity", 0));

    // ===== Value labels trên đầu cột =====
    svg.selectAll(".q11-label")
      .data(data)
      .enter().append("text")
        .attr("class", "q11-label")
        .attr("x", d => x(d.purchaseCount) + x.bandwidth()/2)
        .attr("y", d => y(d.customerCount) - 6)
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .text(d => fmtInt(d.customerCount));

    // ===== Trục phụ đề (tuỳ chọn) =====
    svg.append("text")
      .attr("x", -innerH/2)
      .attr("y", -margin.left + 16)
      .attr("transform", "rotate(-90)")
      .attr("text-anchor", "middle")
      .style("fill", "#374151")
      .style("font-size", "12px")
      .text("Số khách hàng");
  }

  window.renderQ11 = renderQ11;
})();

// script-Q12.js — renderQ12Chart(opts)
// Yêu cầu: đã nhúng D3 v7 trước file này

(function () {
  function ensureTooltip(id = "q12-tooltip") {
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

  // format VND gọn
  const vnd = (n) => n.toLocaleString("vi-VN");

  async function renderQ12Chart(opts) {
    const {
      csvUrl,
      container = "#q12-chart",
      tooltipId = "q12-tooltip",
      widthOuter = 1600,
      heightOuter = 600,
      margin = { top: 50, right: 40, bottom: 110, left: 80 },
      binSize = 50_000,          // kích thước bin (giữ nguyên 50.000 VND)
      barColor = "#4e79a7"
    } = opts;

    const root = d3.select(container).style("overflow-x", "auto");
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

    raw.forEach(d => { d["Thành tiền"] = +d["Thành tiền"]; });

    // Tổng chi theo KH
    const spendingByCustomer = d3.rollups(
      raw,
      v => d3.sum(v, d => d["Thành tiền"]),
      d => d["Mã khách hàng"]
    );

    // Gom bin theo binSize
    const binsMap = new Map(); // key: label -> { count, lower, upper }
    for (const [, totalSpend] of spendingByCustomer) {
      const idx = Math.floor(totalSpend / binSize);
      const lower = idx * binSize;
      const upper = lower + binSize;
      const key = `${(lower/1000)}K–${(upper/1000)}K`;
      if (!binsMap.has(key)) binsMap.set(key, { count: 0, lower, upper });
      binsMap.get(key).count++;
    }

    const data = Array.from(binsMap, ([label, obj]) => ({
      label, ...obj
    })).sort((a, b) => a.lower - b.lower);

    // ===== Scales =====
    const x = d3.scaleBand()
      .domain(data.map(d => d.label))
      .range([0, innerW])
      .padding(0.1);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.count) || 0])
      .nice()
      .range([innerH, 0]);

    // ===== Axes =====
    const xAxis = d3.axisBottom(x)
      .tickFormat((d, i) => (i % 2 === 0 ? d : "")) // ẩn nhãn xen kẽ cho đỡ rối
      .tickSizeOuter(0);

    svg.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(xAxis)
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-0.6em")
      .attr("dy", "0.0em")
      .attr("transform", "rotate(-65)")
      .style("font-size", "12px");

    svg.append("g")
      .call(d3.axisLeft(y).ticks(8).tickSizeOuter(0))
      .selectAll("text")
      .style("font-size", "12px");

    // Grid ngang
    svg.append("g")
      .attr("class", "y-grid")
      .call(d3.axisLeft(y).tickSize(-innerW).tickFormat(() => ""))
      .selectAll("line")
      .attr("stroke", "#e5e7eb")
      .attr("stroke-opacity", 0.6);

    // ===== Bars =====
    svg.selectAll(".q12-bar")
      .data(data)
      .enter().append("rect")
        .attr("class", "q12-bar")
        .attr("x", d => x(d.label))
        .attr("y", d => y(d.count))
        .attr("width", x.bandwidth())
        .attr("height", d => innerH - y(d.count))
        .attr("fill", barColor)
        .on("mouseover", (event, d) => {
          tooltip
            .style("opacity", 1)
            .html(
              `<strong>Khoảng chi:</strong> ${vnd(d.lower)} – ${vnd(d.upper)} VND<br/>
               <strong>Số khách hàng:</strong> ${d.count.toLocaleString("vi-VN")}`
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

    // Nhãn giá trị trên đầu cột (ẩn nếu quá dày)
    if (x.bandwidth() > 18) {
      svg.selectAll(".q12-label")
        .data(data)
        .enter().append("text")
          .attr("class", "q12-label")
          .attr("x", d => x(d.label) + x.bandwidth()/2)
          .attr("y", d => y(d.count) - 6)
          .attr("text-anchor", "middle")
          .style("font-size", "11px")
          .text(d => d.count.toLocaleString("vi-VN"));
    }

    // Trục phụ đề Y (tuỳ chọn)
    svg.append("text")
      .attr("x", -innerH/2)
      .attr("y", -margin.left + 16)
      .attr("transform", "rotate(-90)")
      .attr("text-anchor", "middle")
      .style("fill", "#374151")
      .style("font-size", "12px")
      .text("Số khách hàng");
  }

  window.renderQ12Chart = renderQ12Chart;
})();

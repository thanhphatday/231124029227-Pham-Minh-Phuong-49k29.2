// script-Q1.js (bản có khoảng đệm + thanh trượt ngang)
(function () {
  function ensureTooltip(id = "q1-tooltip") {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement("div");
      el.id = id;
      el.style.position = "absolute";
      el.style.background = "#fff";
      el.style.border = "1px solid #ccc";
      el.style.padding = "8px";
      el.style.borderRadius = "6px";
      el.style.pointerEvents = "none";
      el.style.opacity = 0;
      el.style.fontFamily = "sans-serif";
      el.style.boxShadow = "0 4px 10px rgba(0,0,0,.08)";
      document.body.appendChild(el);
    }
    return d3.select(el);
  }

  const fmtInt = d3.format(",.0f");
  const millionFormat = (v) => fmtInt(v / 1e6) + " triệu";

  async function renderQ1Chart(opts) {
    const {
      csvUrl,
      container = "#q1-chart",
      tooltipId = "q1-tooltip",
      widthOuter = 1200,
      heightOuter = 600,
      // mới thêm:
      legendWidth = 220,   // bề rộng khu legend
      labelGap   = 70      // khoảng cách giữa nhãn giá trị và legend
    } = opts;

    // Cho phép cuộn ngang ở container
    const root = d3.select(container)
      .style("overflow-x", "auto");   // scrollbar ngang nếu cần
    root.selectAll("*").remove();

    const margin = { top: 20, right: 260, bottom: 50, left: 200 };
    const width  = widthOuter - margin.left - margin.right;
    const height = heightOuter - margin.top  - margin.bottom;

    // Tăng chiều rộng SVG để dành chỗ cho legend và khoảng đệm
    const svgOuterWidth = widthOuter + legendWidth + labelGap;

    const svg = root
      .append("svg")
      .attr("width",  svgOuterWidth)
      .attr("height", heightOuter)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const tooltip = ensureTooltip(tooltipId);

    // ===== Load & chuẩn hoá dữ liệu =====
    let rawData;
    try {
      rawData = await d3.csv(csvUrl);
    } catch (e) {
      console.error("Lỗi khi load CSV:", e);
      return;
    }

    rawData.forEach((d) => {
      d["Thành tiền"] = +d["Thành tiền"];
      d["Số lượng bán"] =
        d["Số lượng bán"] == null || d["Số lượng bán"] === ""
          ? (+d["SL"] || 0)
          : +d["Số lượng bán"];
    });

    const nested = d3.rollup(
      rawData,
      (v) => ({
        doanhThu: d3.sum(v, (x) => x["Thành tiền"]),
        soLuong : d3.sum(v, (x) => x["Số lượng bán"]),
        maMatHang : v[0]["Mã mặt hàng"],
        maNhomHang: v[0]["Mã nhóm hàng"],
        nhomHang  : v[0]["Tên nhóm hàng"]
      }),
      (d) => d["Tên mặt hàng"]
    );

    const data = Array.from(nested, ([tenMatHang, values]) => ({
      tenMatHang: `[${values.maMatHang}] ${tenMatHang}`,
      ...values
    })).sort((a,b) => b.doanhThu - a.doanhThu);

    // ===== Scales & axes =====
    const color = d3.scaleOrdinal()
      .domain(["BOT","THO","TTC","TMX","SET"])
      .range(d3.schemeTableau10);

    const y = d3.scaleBand()
      .domain(data.map(d => d.tenMatHang))
      .range([0, height])
      .padding(0.2);

    const x = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.doanhThu) || 0])
      .nice()
      .range([0, width]);

    svg.append("g").call(d3.axisLeft(y));

    svg.append("g")
      .attr("transform", `translate(0, ${height})`)
      .call(
        d3.axisBottom(x)
          .ticks(15)
          .tickFormat(v => millionFormat(v))
          .tickSizeOuter(0)
      );

    // ===== Bars =====
    const bars = svg.selectAll(".q1-bar")
      .data(data)
      .enter().append("rect")
        .attr("class", "q1-bar")
        .attr("y", d => y(d.tenMatHang))
        .attr("x", 0)
        .attr("height", y.bandwidth())
        .attr("width", d => x(d.doanhThu))
        .attr("fill", d => color(d.maNhomHang))
        .on("mouseover", (event, d) => {
          tooltip.style("opacity", 1)
            .html(
              `Mặt hàng: <strong>${d.tenMatHang}</strong><br>
               Nhóm hàng: [${d.maNhomHang}] ${d.nhomHang}<br>
               Doanh thu: ${millionFormat(d.doanhThu)} VND<br>
               Số lượng bán: ${fmtInt(d.soLuong)}`
            )
            .style("left", event.pageX + 10 + "px")
            .style("top",  event.pageY - 28 + "px");
        })
        .on("mousemove", (event) => {
          tooltip.style("left", event.pageX + 10 + "px")
                 .style("top",  event.pageY - 28 + "px");
        })
        .on("mouseout", () => tooltip.style("opacity", 0));

    // ===== Value labels (có giới hạn để không chạm legend) =====
    const maxLabelX = width + labelGap - 8; // mép trái của vùng legend trừ 8px
    svg.selectAll(".q1-label")
      .data(data)
      .enter().append("text")
        .attr("x", d => Math.min(x(d.doanhThu) + 5, maxLabelX))
        .attr("y", d => y(d.tenMatHang) + y.bandwidth()/2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "start")
        .style("font-size", "12px")
        .text(d => fmtInt(d.doanhThu/1e6) + " triệu VND");

    // ===== Legend (đặt cách nhãn 1 khoảng labelGap) =====
    const presentCodes = new Set(data.map(d => d.maNhomHang));
    const codeToName = new Map();
    data.forEach(d => { if (!codeToName.has(d.maNhomHang)) codeToName.set(d.maNhomHang, d.nhomHang); });

    const legendData = color.domain()
      .filter(code => presentCodes.has(code))
      .map(code => ({ code, name: codeToName.get(code) || code }));

    const legendX = width + labelGap; // tách legend khỏi chart 1 khoảng
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

  window.renderQ1Chart = renderQ1Chart;
})();

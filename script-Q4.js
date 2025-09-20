// script-Q4.js — renderQ4Chart(opts)
// Yêu cầu: đã nhúng D3 v7 trước file này

(function () {
  function ensureTooltip(id = "q4-tooltip") {
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

  async function renderQ4Chart(opts) {
    const {
      csvUrl,
      container = "#q4-chart",
      tooltipId = "q4-tooltip",
      widthOuter = 1300,
      heightOuter = 600
    } = opts;

    const root = d3.select(container).style("overflow-x", "auto");
    root.selectAll("*").remove();

    const margin = { top: 20, right: 20, bottom: 60, left: 140 };
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
      // dùng "SL" cho nhất quán (như Q1/Q2/Q3)
      d["SL"] = +(d["SL"] ?? d["Số lượng"] ?? 0);
      const t = String(d["Thời gian tạo đơn"] || "");
      // Date.getDay(): 0=CN,1=Hai,...6=Bảy
      d.__dayIndex = new Date(t).getDay();
      // Key ngày (yyyy-mm-dd) để đếm số ngày có đơn
      d.__dayKey = t.split(" ")[0]; // nếu có cả giờ phút
    });

    const weekdays = ["Thứ Hai","Thứ Ba","Thứ Tư","Thứ Năm","Thứ Sáu","Thứ Bảy","Chủ Nhật"];
    const weekdayOrderMap = {1:"Thứ Hai",2:"Thứ Ba",3:"Thứ Tư",4:"Thứ Năm",5:"Thứ Sáu",6:"Thứ Bảy",0:"Chủ Nhật"};

    // group theo dayIndex
    const grouped = d3.group(raw, d => d.__dayIndex);

    const data = Array.from(grouped, ([idx, rows]) => {
      const doanhThuTong = d3.sum(rows, r => r["Thành tiền"]);
      const soLuongTong  = d3.sum(rows, r => r["SL"]);
      const soNgayCoDon  = new Set(rows.map(r => r.__dayKey)).size;
      const doanhThuTB   = soNgayCoDon > 0 ? doanhThuTong / soNgayCoDon : 0;
      const soLuongTB    = soNgayCoDon > 0 ? soLuongTong / soNgayCoDon : 0;
      return { Ngày: weekdayOrderMap[idx], idx, doanhThuTB, soLuongTB };
    })
    // sắp thứ tự đúng thứ Hai -> Chủ Nhật
    .sort((a, b) => {
      const order = { "Thứ Hai":0,"Thứ Ba":1,"Thứ Tư":2,"Thứ Năm":3,"Thứ Sáu":4,"Thứ Bảy":5,"Chủ Nhật":6 };
      return order[a.Ngày] - order[b.Ngày];
    });

    // ==== Scales ====
    const x = d3.scaleBand()
      .domain(data.map(d => d.Ngày))
      .range([0, width])
      .padding(0.2);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.doanhThuTB) || 0]).nice()
      .range([height, 0]);

    // Màu ổn định theo ngày
    const color = d3.scaleOrdinal()
      .domain(weekdays)
      .range(d3.schemeTableau10);

    // ==== Axes (formatter triệu/tỷ) ====
    svg.append("g")
      .attr("transform", `translate(0, ${height})`)
      .call(d3.axisBottom(x).tickSizeOuter(0))
      .selectAll("text")
      .style("font-size", "12px");

    svg.append("g")
      .call(d3.axisLeft(y).ticks(8).tickFormat(v => fmtTriệuTỷ(v)).tickSizeOuter(0))
      .selectAll("text")
      .style("font-size", "12px");

    // ==== Bars ====
    const bars = svg.selectAll(".q4-bar")
      .data(data)
      .enter().append("rect")
        .attr("class", "q4-bar")
        .attr("x", d => x(d.Ngày))
        .attr("y", d => y(d.doanhThuTB))
        .attr("width", x.bandwidth())
        .attr("height", d => height - y(d.doanhThuTB))
        .attr("fill", d => color(d.Ngày))
        .on("mouseover", (event, d) => {
          tooltip
            .style("opacity", 1)
            .html(
              `<strong>${d.Ngày}</strong><br>
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

    // ==== Nhãn trên cột ====
    svg.selectAll(".q4-label")
      .data(data)
      .enter().append("text")
        .attr("class", "q4-label")
        .attr("x", d => x(d.Ngày) + x.bandwidth()/2)
        .attr("y", d => y(d.doanhThuTB) - 6)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .text(d => fmtTriệuTỷVND(d.doanhThuTB));
  }

  window.renderQ4Chart = renderQ4Chart;
})();

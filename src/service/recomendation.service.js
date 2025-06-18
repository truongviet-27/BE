import { dot, index, matrix, range, zeros, subset } from "mathjs";
import { ErrorCustom } from "../helper/ErrorCustom.js";
import Attribute from "../model/attribute.js";
import Brand from "../model/brand.js";
import Image from "../model/image.js";
import Product from "../model/product.js";
import Sale from "../model/sale.js";

const combineFeatures = ({ code, name, description }) =>
    `${code} ${name} ${description}`;

const calculateTfIdf = async (featuresList) => {
    const documentFrequency = new Map();
    const termFrequencyList = [];

    featuresList.forEach((features) => {
        const terms = features
            .toLowerCase()
            .split(/([()\-\u2013\u2014,\.!"'‘’])|\s+/)
            .filter(
                (term) => term && !/([()\-\u2013\u2014,\.!"'‘’])|\s+/.test(term)
            );
        const termFrequency = new Map();
        const uniqueTerms = new Set();

        terms.forEach((term) => {
            termFrequency.set(term, (termFrequency.get(term) || 0) + 1);

            if (!uniqueTerms.has(term)) {
                uniqueTerms.add(term);
                documentFrequency.set(
                    term,
                    (documentFrequency.get(term) || 0) + 1
                );
            }
        });

        for (const [term, count] of termFrequency) {
            termFrequency.set(term, count / terms.length);
        }

        termFrequencyList.push(termFrequency);
    });

    const totalDocs = featuresList.length;
    const tfidfMatrix = termFrequencyList.map((termFrequency) => {
        const tfidf = new Map();
        for (const [term, tf] of termFrequency) {
            const df = documentFrequency.get(term) || 0;
            const idf = Math.log((totalDocs + 1) / (df + 1) + 1);
            tfidf.set(term, tf * idf);
        }
        return tfidf;
    });

    return tfidfMatrix;
};

const calculateCosineSimilarity = (tfidfMatrix) => {
    const allTerms = new Set(tfidfMatrix.flatMap((tfidf) => [...tfidf.keys()]));

    const tfidfVectors = tfidfMatrix.map((tfidf) =>
        [...allTerms].map((term) => tfidf.get(term) || 0)
    );

    const mat = matrix(tfidfVectors);
    const rowCount = mat.size()[0];
    const colCount = mat.size()[1];
    const similarityMatrix = zeros(rowCount, rowCount).toArray();

    for (let i = 0; i < rowCount; i++) {
        const vecI = mat.subset(index(i, range(0, colCount))).toArray()[0];
        for (let j = 0; j < rowCount; j++) {
            const vecJ = mat.subset(index(j, range(0, colCount))).toArray()[0];
            similarityMatrix[i][j] = cosineValueSimilarity(vecI, vecJ);
        }
    }
    return similarityMatrix;
};

const cosineValueSimilarity = (vector1, vector2) => {
    const dotProduct = dot(vector1, vector2);
    const normA = Math.sqrt(dot(vector1, vector1));
    const normB = Math.sqrt(dot(vector2, vector2));
    const result = dotProduct / (normA * normB);
    return isNaN(result) ? 0 : Math.round(result * 1000) / 1000;
};

const getRecommendationsService = async (productId, page = 0, size = 5) => {
    const products = await Product.aggregate([
        {
            $match: {},
        },
        {
            $lookup: {
                from: "product_user_likes",
                localField: "_id",
                foreignField: "product",
                as: "likeQuantity",
            },
        },
    ]);
    const featuresList = products.map((product) =>
        combineFeatures({
            code: product.code,
            name: product.name,
            description: product.description,
        })
    );

    const tfidfMatrix = await calculateTfIdf(featuresList);
    const similarityMatrix = calculateCosineSimilarity(tfidfMatrix);

    const indexProduct = products.findIndex(
        (p) => p._id.toString() === productId.toString()
    );
    if (indexProduct === -1) throw new ErrorCustom("Sản phẩm không tồn tại!");

    const similarProducts = new Map(
        similarityMatrix[indexProduct].map((score, i) => [i, score])
    );

    const sortedProductIndices = [...similarProducts.entries()]
        .sort(([_, scoreA], [__, scoreB]) => scoreB - scoreA)
        .map(([index]) => index);

    const productList = [];
    const productSimilarityMap = new Map();
    for (let i = 1; i < sortedProductIndices.length; i++) {
        const product = products[sortedProductIndices[i]];
        const cosineValue = similarProducts.get(sortedProductIndices[i]);
        productList.push(product);
        productSimilarityMap.set(product._id.toString(), cosineValue);
    }
    const startIndex = page * size;
    const paginatedProducts = productList.slice(startIndex, startIndex + size);
    const total = productList.length;

    const productIds = paginatedProducts.map((p) => p._id);
    const [attributes, brands, sales, images] = await Promise.all([
        Attribute.find({ product: { $in: productIds } }),
        Brand.find({ _id: { $in: paginatedProducts.map((p) => p.brand) } }),
        Sale.find({ _id: { $in: paginatedProducts.map((p) => p.sale) } }),
        Image.find({ product: { $in: productIds } }),
    ]);

    const attributeMap = new Map();

    attributes.forEach((attr) => {
        const key = attr?.product?.toString();
        if (!attributeMap.has(key)) {
            attributeMap.set(key, []);
        }
        attributeMap.get(key).push({
            _id: attr._id,
            price: attr.price,
            size: attr.size,
            stock: attr.stock,
            cache: attr.cache,
            product: attr.product,
        });
    });

    const brandMap = new Map(brands?.map((b) => [b?._id?.toString(), b]));
    const saleMap = new Map(sales?.map((s) => [s?._id?.toString(), s]));
    const imageMap = new Map(
        images?.map((img) => [img?.product?.toString(), img])
    );

    const productDtos = paginatedProducts.map(
        ({
            _id,
            name,
            code,
            view,
            description,
            brand,
            sale,
            isActive,
            likeQuantity,
        }) => ({
            _id,
            code,
            name,
            description,
            image: imageMap.get(_id?.toString())?.url ?? "",
            isActive,
            attributes: attributeMap.get(_id?.toString()),
            brand: brandMap.get(brand?.toString()),
            view,
            sale: saleMap.get(sale?.toString()),
            likeQuantity: likeQuantity.length ?? 0,
            similarity: productSimilarityMap.get(_id?.toString()) ?? 0,
        })
    );

    return {
        data: productDtos,
        pagination: {
            page,
            size,
            total,
            totalPages: Math.ceil(total / size),
        },
    };
};

export default getRecommendationsService;
